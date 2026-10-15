import os
import re
import smtplib
import secrets
import logging
from pathlib import Path
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Dict, Any, Optional, Tuple

from backend.config import settings

logger = logging.getLogger("epidemiology.email")

BACKEND_DIR = Path(__file__).resolve().parent.parent
BACKEND_ENV_PATH = BACKEND_DIR / ".env"
ROOT_ENV_PATH = BACKEND_DIR.parent / ".env"


class EmailAlertDeduplicator:
    """
    Suppresses redundant email alerts for the same ward, risk level, and date
    within the configured alert cooldown window.
    """
    def __init__(self, cooldown_hours: int = 12):
        self.cooldown_hours = cooldown_hours
        self.history: Dict[str, datetime] = {}

    def get_key(self, ward_name: str, disease: str, alert_date: str) -> str:
        return f"{ward_name.strip().lower()}:{disease.strip().lower()}:{alert_date.strip().lower()}"

    def is_duplicate(self, ward_name: str, disease: str, alert_date: str) -> Tuple[bool, Optional[str]]:
        key = self.get_key(ward_name, disease, alert_date)
        last_sent = self.history.get(key)
        if not last_sent:
            return False, None
        elapsed_hours = (datetime.now(timezone.utc) - last_sent).total_seconds() / 3600.0
        if elapsed_hours < self.cooldown_hours:
            return True, f"Email alert for {ward_name} ({disease}) was already dispatched at {last_sent.strftime('%H:%M UTC')}. Cooldown is {self.cooldown_hours}h."
        return False, None

    def record_dispatch(self, ward_name: str, disease: str, alert_date: str):
        key = self.get_key(ward_name, disease, alert_date)
        self.history[key] = datetime.now(timezone.utc)

    def clear(self):
        self.history.clear()


class EmailAlertService:
    def __init__(self):
        self.dispatch_history: List[Dict[str, Any]] = []
        self.deduplicator = EmailAlertDeduplicator(
            cooldown_hours=getattr(settings, "ALERT_COOLDOWN_HOURS", 12)
        )
        self._load_history_from_db()

    def _load_history_from_db(self):
        try:
            from backend.db import get_email_audits
            audits = get_email_audits(50)
            if audits:
                self.dispatch_history = audits
        except Exception as e:
            logger.debug(f"Could not load email history from db: {e}")


    def get_credentials(self) -> Dict[str, Any]:
        """
        Reads SMTP configuration securely from backend/.env first, then root .env,
        then os.environ, then settings.
        Filters out placeholders and whitespace.
        """
        backend_vars: Dict[str, str] = {}
        if BACKEND_ENV_PATH.exists():
            try:
                from dotenv import dotenv_values
                loaded = dotenv_values(BACKEND_ENV_PATH)
                if loaded:
                    for k, v in loaded.items():
                        if v is not None:
                            backend_vars[k.strip()] = str(v).strip().strip("'\"").strip()
            except Exception as e:
                logger.debug(f"Could not parse backend/.env: {e}")

        root_vars: Dict[str, str] = {}
        if ROOT_ENV_PATH.exists():
            try:
                from dotenv import dotenv_values
                loaded = dotenv_values(ROOT_ENV_PATH)
                if loaded:
                    for k, v in loaded.items():
                        if v is not None:
                            root_vars[k.strip()] = str(v).strip().strip("'\"").strip()
            except Exception as e:
                logger.debug(f"Could not parse root .env: {e}")

        def _resolve(key: str, default: Any = "") -> str:
            val = (
                backend_vars.get(key)
                or root_vars.get(key)
                or os.getenv(key)
                or str(getattr(settings, key, default) or "")
            )
            return str(val).strip().strip("'\"").strip()

        host = _resolve("SMTP_HOST", "smtp.gmail.com")
        port_raw = _resolve("SMTP_PORT", "587")
        try:
            port = int(port_raw)
        except ValueError:
            port = 587

        user = _resolve("SMTP_USER", "")
        password = _resolve("SMTP_PASSWORD", "")
        from_email = _resolve("SMTP_FROM_EMAIL", user)
        use_tls_raw = _resolve("SMTP_USE_TLS", "True").lower()
        use_tls = use_tls_raw in ("true", "1", "yes", "t")

        # Discard placeholder templates
        if password.lower() in ("your_16_character_app_password", "your_smtp_password_here", "password", ""):
            password = ""
        if user.lower() in ("your_email@gmail.com", "user@example.com", ""):
            user = ""

        return {
            "smtp_host": host or "smtp.gmail.com",
            "smtp_port": port,
            "smtp_user": user,
            "smtp_password": password,
            "smtp_from_email": from_email or user,
            "smtp_use_tls": use_tls,
        }

    def validate_smtp(self) -> Dict[str, Any]:
        """Validates configuration readiness without leaking passwords."""
        creds = self.get_credentials()
        has_host = bool(creds["smtp_host"])
        has_user = bool(creds["smtp_user"])
        has_pass = bool(creds["smtp_password"])
        is_configured = bool(has_host and has_user and has_pass)

        # Mask user email for privacy
        masked_user = ""
        if has_user:
            parts = creds["smtp_user"].split("@")
            if len(parts) == 2:
                prefix = parts[0]
                masked_prefix = prefix[:2] + "***" if len(prefix) > 2 else "***"
                masked_user = f"{masked_prefix}@{parts[1]}"
            else:
                masked_user = creds["smtp_user"][:3] + "***"

        instructions = (
            "To enable genuine automated email alerts for High Risk wards, configure SMTP in backend/.env:\n"
            "SMTP_HOST=smtp.gmail.com\n"
            "SMTP_PORT=587\n"
            "SMTP_USER=your_email@gmail.com\n"
            "SMTP_PASSWORD=your_16_character_app_password (generate at: https://myaccount.google.com/apppasswords)\n"
            "SMTP_FROM_EMAIL=your_email@gmail.com\n"
            "SMTP_USE_TLS=True"
        ) if not is_configured else f"SMTP Email Gateway is active via {creds['smtp_host']}:{creds['smtp_port']}."

        return {
            "configured": is_configured,
            "smtp_host": creds["smtp_host"],
            "smtp_port": creds["smtp_port"],
            "smtp_user": masked_user,
            "has_credentials": is_configured,
            "status": "READY" if is_configured else "SMTP_NOT_CONFIGURED",
            "delivery_status": "READY" if is_configured else "SMTP_NOT_CONFIGURED",
            "instructions": instructions,
        }

    def _record_dispatch(self, record: Dict[str, Any]):
        self.dispatch_history.insert(0, record)
        if len(self.dispatch_history) > 100:
            self.dispatch_history.pop()
        try:
            from backend.db import save_email_audit
            save_email_audit(record)
        except Exception as e:
            logger.debug(f"Failed to persist email alert to db: {e}")

    def update_env_file(self, updates: Dict[str, str]) -> bool:
        """Persists SMTP configuration updates to backend/.env safely."""
        try:
            BACKEND_ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
            lines: List[str] = []
            if BACKEND_ENV_PATH.exists():
                with open(BACKEND_ENV_PATH, "r", encoding="utf-8") as f:
                    lines = f.readlines()

            updated_keys = set()
            new_lines = []
            for line in lines:
                matched = False
                for k, v in updates.items():
                    if line.strip().startswith(f"{k}=") or line.strip().startswith(f"#{k}="):
                        new_lines.append(f"{k}={v}\n")
                        updated_keys.add(k)
                        matched = True
                        break
                if not matched:
                    new_lines.append(line)

            for k, v in updates.items():
                if k not in updated_keys:
                    new_lines.append(f"{k}={v}\n")

            with open(BACKEND_ENV_PATH, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
            return True
        except Exception as e:
            logger.error(f"Failed to update backend/.env: {e}")
            return False

    def build_email_content(
        self,
        district: str,
        ward: str,
        disease: str,
        risk_level: str,
        prediction_date: str,
        recommended_actions: List[str],
        cases: Optional[int] = None,
        recipient_name: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Builds both plain-text and HTML email bodies containing:
        District, Ward, Disease, Risk Level, Prediction Date, and Recommended Actions.
        """
        officer_display = recipient_name or "Authorized Municipal Health Officer"
        cases_text = f"Reported/Predicted Cases: {cases}" if cases is not None else ""

        # Plain-text version
        actions_plain = "\n".join([f"  • {action}" for action in recommended_actions])
        text_body = f"""
================================================================================
URGENT PUBLIC HEALTH OUTBREAK WARNING — {risk_level.upper()}
Coimbatore Municipal Corporation | Epidemic Surveillance Division
================================================================================

To: {officer_display}

A high-risk vector-borne disease outbreak condition has been detected by the
OutbreakWatch AI Surveillance Platform.

EPIDEMIOLOGICAL ALERT SUMMARY:
--------------------------------------------------------------------------------
• District:             {district}
• Ward / Location:      {ward}
• Disease Monitored:    {disease}
• Risk Classification:  {risk_level}
• Prediction Date:      {prediction_date}
{f'• Case Load:           {cases}' if cases is not None else ''}
--------------------------------------------------------------------------------

MANDATED MUNICIPAL INTERVENTION ACTIONS:
{actions_plain}

Please deploy rapid response field personnel immediately to contain transmission.

System: OutbreakWatch AI Disease Surveillance System
Authority: Public Health & Epidemic Surveillance Division, Coimbatore
Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}
================================================================================
""".strip()

        # HTML version
        actions_html = "".join([f"<li style='margin-bottom: 8px;'>{action}</li>" for action in recommended_actions])
        cases_badge = f"<div style='font-size: 14px; margin-top: 4px; color: #f87171;'>Current/Predicted Case Count: <strong>{cases}</strong></div>" if cases is not None else ""

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f1f5f9; margin: 0; padding: 24px; }}
  .container {{ max-width: 620px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
  .header {{ background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%); padding: 24px; text-align: left; color: #ffffff; }}
  .header-badge {{ display: inline-block; background-color: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.4); padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }}
  .title {{ font-size: 20px; font-weight: 800; margin: 12px 0 4px 0; }}
  .subtitle {{ font-size: 13px; opacity: 0.9; margin: 0; }}
  .body {{ padding: 24px; }}
  .officer-salute {{ font-size: 14px; color: #94a3b8; margin-bottom: 16px; }}
  .summary-card {{ background-color: #0f172a; border-radius: 8px; border: 1px solid #334155; padding: 18px; margin-bottom: 20px; }}
  .summary-table {{ width: 100%; border-collapse: collapse; }}
  .summary-table td {{ padding: 8px 6px; font-size: 13px; border-bottom: 1px solid #1e293b; }}
  .summary-table tr:last-child td {{ border-bottom: none; }}
  .label {{ color: #94a3b8; font-weight: 600; width: 40%; }}
  .val {{ color: #ffffff; font-weight: 700; }}
  .val-danger {{ color: #ef4444; font-weight: 800; }}
  .actions-card {{ background-color: rgba(220, 38, 38, 0.08); border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 24px; }}
  .actions-title {{ font-size: 14px; font-weight: 700; color: #f87171; margin: 0 0 10px 0; }}
  .actions-list {{ margin: 0; padding-left: 20px; font-size: 13px; color: #e2e8f0; line-height: 1.5; }}
  .footer {{ background-color: #0b1120; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; }}
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="header-badge">Critical Outbreak Early Warning</span>
      <h1 class="title">HIGH RISK EPIDEMIOLOGICAL ALERT</h1>
      <p class="subtitle">Coimbatore Municipal Corporation · Public Health Division</p>
    </div>
    <div class="body">
      <div class="officer-salute">
        Attention: <strong>{officer_display}</strong>,
      </div>
      <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6; margin-bottom: 18px;">
        The predictive surveillance model has flagged elevated vector-borne disease transmission requiring urgent municipal containment.
      </p>

      <div class="summary-card">
        <table class="summary-table">
          <tr>
            <td class="label">District:</td>
            <td class="val">{district}</td>
          </tr>
          <tr>
            <td class="label">Municipal Ward:</td>
            <td class="val">{ward}</td>
          </tr>
          <tr>
            <td class="label">Disease Monitored:</td>
            <td class="val">{disease}</td>
          </tr>
          <tr>
            <td class="label">Risk Classification:</td>
            <td class="val val-danger">{risk_level}</td>
          </tr>
          <tr>
            <td class="label">Forecast Date:</td>
            <td class="val">{prediction_date}</td>
          </tr>
        </table>
        {cases_badge}
      </div>

      <div class="actions-card">
        <div class="actions-title">Mandated Epidemiological Containment Actions:</div>
        <ul class="actions-list">
          {actions_html}
        </ul>
      </div>

      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        Access full ward demographics, weather vulnerability, and active spot mapping on the municipal dashboard.
      </p>
    </div>
    <div class="footer">
      Generated automatically by OutbreakWatch AI Disease Surveillance System.<br>
      Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}
    </div>
  </div>
</body>
</html>
""".strip()
        return text_body, html_body

    async def dispatch_high_risk_email(
        self,
        recipient_email: str,
        recipient_name: str,
        district: str,
        ward: str,
        disease: str,
        risk_level: str = "HIGH RISK",
        cases: Optional[int] = None,
        prediction_date: Optional[str] = None,
        recommended_actions: Optional[List[str]] = None,
        force: bool = False
    ) -> Dict[str, Any]:
        """
        Dispatches a genuine email alert to the authorized municipal monitoring officer.
        Strictly preserves truth in status:
        - NEVER simulates successful email delivery.
        - Only returns SENT when confirmed by the SMTP mail transfer agent.
        - Honestly returns SMTP_NOT_CONFIGURED, SMTP_AUTHENTICATION_FAILED, or specific error.
        """
        pred_date = prediction_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        actions = recommended_actions or [
            "Initiate immediate thermal ultra-low volume (ULV) fogging across residential clusters.",
            "Deploy source reduction squads for abate larviciding in overhead tanks, sumps, and open drains.",
            "Activate mobile fever clinic and rapid NS1 diagnostic testing at the local Primary Health Centre (PHC).",
            "Broadcast vector awareness and dry-day advisories to resident welfare associations.",
            "Alert Coimbatore Medical College Hospital (CMCH) and ESI Hospital for inpatient bed readiness."
        ]

        # 1. Deduplication check
        if not force:
            is_dup, dup_reason = self.deduplicator.is_duplicate(ward, disease, pred_date)
            if is_dup:
                return {
                    "id": f"email-{secrets.token_hex(6)}",
                    "status": "suppressed",
                    "delivery_status": "SUPPRESSED_DUPLICATE",
                    "delivery_confirmed": False,
                    "recipient_email": recipient_email,
                    "district": district,
                    "ward": ward,
                    "disease": disease,
                    "risk_level": risk_level,
                    "prediction_date": pred_date,
                    "error": dup_reason,
                    "status_note": dup_reason,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

        # 2. Check SMTP configuration
        validation = self.validate_smtp()
        if not validation["configured"]:
            record = {
                "id": f"email-{secrets.token_hex(6)}",
                "status": "unconfigured",
                "delivery_status": "SMTP_NOT_CONFIGURED",
                "carrier_stage": "GATEWAY_NOT_CONFIGURED",
                "delivery_confirmed": False,
                "recipient_email": recipient_email,
                "recipient_name": recipient_name,
                "district": district,
                "ward": ward,
                "disease": disease,
                "risk_level": risk_level,
                "prediction_date": pred_date,
                "error": "SMTP server credentials not configured in backend/.env. Add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD to send genuine email alerts.",
                "status_note": "SMTP credentials missing. Alert recorded in audit trail as SMTP_NOT_CONFIGURED.",
                "instructions": validation.get("instructions"),
                "recommended_actions": actions,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            self._record_dispatch(record)
            return record

        creds = self.get_credentials()
        host = creds["smtp_host"]
        port = creds["smtp_port"]
        user = creds["smtp_user"]
        password = creds["smtp_password"]
        from_email = creds["smtp_from_email"] or user
        use_tls = creds["smtp_use_tls"]

        # 3. Construct MIME message
        text_body, html_body = self.build_email_content(
            district=district,
            ward=ward,
            disease=disease,
            risk_level=risk_level,
            prediction_date=pred_date,
            recommended_actions=actions,
            cases=cases,
            recipient_name=recipient_name
        )

        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[CRITICAL OUTBREAK ALERT] High Risk in {ward} ({disease}) — {district}"
        msg["From"] = f"Epidemiology Surveillance <{from_email}>"
        msg["To"] = recipient_email
        msg["Date"] = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        # 4. Attempt real SMTP dispatch
        server = None
        record_id = f"email-{secrets.token_hex(6)}"
        try:
            if use_tls:
                server = smtplib.SMTP(host=host, port=port, timeout=12)
                server.ehlo()
                server.starttls()
                server.ehlo()
            else:
                server = smtplib.SMTP_SSL(host=host, port=port, timeout=12)
                server.ehlo()

            server.login(user, password)
            server.sendmail(from_email, [recipient_email], msg.as_string())
            server.quit()
            server = None

            # Mark deduplication and record success
            self.deduplicator.record_dispatch(ward, disease, pred_date)
            record = {
                "id": record_id,
                "status": "delivered",
                "delivery_status": "SENT",
                "carrier_stage": "SMTP_DELIVERED_TO_MAIL_SERVER",
                "delivery_confirmed": True,
                "recipient_email": recipient_email,
                "recipient_name": recipient_name,
                "district": district,
                "ward": ward,
                "disease": disease,
                "risk_level": risk_level,
                "prediction_date": pred_date,
                "smtp_server": f"{host}:{port}",
                "error": None,
                "status_note": f"Confirmed delivery via SMTP server ({host}:{port}) to {recipient_email}.",
                "recommended_actions": actions,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            self._record_dispatch(record)
            logger.info(f"Genuine email alert dispatched to {recipient_email} for ward {ward}")
            return record

        except smtplib.SMTPAuthenticationError as auth_err:
            err_text = str(auth_err.smtp_error.decode("utf-8", "ignore") if hasattr(auth_err.smtp_error, "decode") else auth_err.smtp_error or auth_err)
            record = {
                "id": record_id,
                "status": "authentication_failed",
                "delivery_status": "SMTP_AUTHENTICATION_FAILED",
                "carrier_stage": "AUTHENTICATION_REJECTED",
                "delivery_confirmed": False,
                "recipient_email": recipient_email,
                "recipient_name": recipient_name,
                "district": district,
                "ward": ward,
                "disease": disease,
                "risk_level": risk_level,
                "prediction_date": pred_date,
                "smtp_server": f"{host}:{port}",
                "error": f"SMTP Authentication failed: {err_text}. If using Gmail, generate a 16-character App Password at https://myaccount.google.com/apppasswords.",
                "status_note": f"SMTP rejected credentials for user {user}.",
                "recommended_actions": actions,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            self._record_dispatch(record)
            return record

        except smtplib.SMTPConnectError as conn_err:
            record = {
                "id": record_id,
                "status": "connection_failed",
                "delivery_status": "SMTP_CONNECTION_FAILED",
                "carrier_stage": "CONNECTION_REFUSED",
                "delivery_confirmed": False,
                "recipient_email": recipient_email,
                "recipient_name": recipient_name,
                "district": district,
                "ward": ward,
                "disease": disease,
                "risk_level": risk_level,
                "prediction_date": pred_date,
                "smtp_server": f"{host}:{port}",
                "error": f"Could not connect to SMTP server at {host}:{port}: {conn_err}",
                "status_note": "Connection timed out or refused by SMTP host.",
                "recommended_actions": actions,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            self._record_dispatch(record)
            return record

        except smtplib.SMTPRecipientsRefused as rec_err:
            record = {
                "id": record_id,
                "status": "recipient_refused",
                "delivery_status": "RECIPIENT_REFUSED",
                "carrier_stage": "RECIPIENT_REJECTED",
                "delivery_confirmed": False,
                "recipient_email": recipient_email,
                "recipient_name": recipient_name,
                "district": district,
                "ward": ward,
                "disease": disease,
                "risk_level": risk_level,
                "prediction_date": pred_date,
                "smtp_server": f"{host}:{port}",
                "error": f"Recipient email refused by server: {rec_err}",
                "status_note": f"Server rejected address {recipient_email}.",
                "recommended_actions": actions,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            self._record_dispatch(record)
            return record

        except Exception as e:
            record = {
                "id": record_id,
                "status": "failed",
                "delivery_status": "FAILED",
                "carrier_stage": "TRANSMISSION_ERROR",
                "delivery_confirmed": False,
                "recipient_email": recipient_email,
                "recipient_name": recipient_name,
                "district": district,
                "ward": ward,
                "disease": disease,
                "risk_level": risk_level,
                "prediction_date": pred_date,
                "smtp_server": f"{host}:{port}",
                "error": f"Email transmission failed: {str(e)}",
                "status_note": "Unexpected network or SMTP protocol error.",
                "recommended_actions": actions,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            self._record_dispatch(record)
            return record

        finally:
            if server:
                try:
                    server.close()
                except Exception:
                    pass

    async def dispatch_test_email(
        self,
        recipient_email: str,
        recipient_name: Optional[str] = None,
        note: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends a test email alert to the authorized municipal officer.
        - If SMTP credentials are configured, sends genuine email over SMTP.
        - If SMTP credentials are NOT configured, generates a demonstration outbreak alert in demo mode.
        - Honestly distinguishes simulated alert (delivery_status='DEMO_VERIFIED', delivery_confirmed=False).
        - Saves each alert attempt to the backend SQLite database and updates the audit log.
        - Permits repeated clicks using the same officer details without duplicate rejection.
        """
        validation = self.validate_smtp()
        officer_name = recipient_name or "Authorized Municipal Officer"
        pred_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        actions = [
            "Initiate immediate thermal ultra-low volume (ULV) fogging across residential clusters.",
            "Deploy source reduction squads for abate larviciding in overhead tanks, sumps, and open drains.",
            "Activate mobile fever clinic and rapid NS1 diagnostic testing at the local Primary Health Centre (PHC).",
            "Broadcast vector awareness and dry-day advisories to resident welfare associations.",
            "Alert Coimbatore Medical College Hospital (CMCH) and ESI Hospital for inpatient bed readiness."
        ]

        if validation["configured"]:
            return await self.dispatch_high_risk_email(
                recipient_email=recipient_email,
                recipient_name=officer_name,
                district="Coimbatore",
                ward="Ward 07 (Gandhipuram) — TEST VERIFICATION",
                disease="Dengue Surveillance Test",
                risk_level="HIGH RISK (TEST ALERT)",
                cases=29,
                prediction_date=pred_date,
                recommended_actions=[
                    "Verify SMTP connectivity between Epidemiology platform and municipal officer mailbox.",
                    "Confirm that High Risk ward alert templates render correctly on desktop and mobile clients.",
                    note or "This is a single verification test dispatch initiated by the authenticated municipal officer."
                ],
                force=True
            )

        # Demonstration Outbreak Email Alert (Unconfigured SMTP Demo Mode)
        record_id = f"email-demo-{secrets.token_hex(6)}"
        timestamp = datetime.now(timezone.utc).isoformat()
        ward_name = "Ward 07 (Gandhipuram)"
        disease_name = "Dengue"
        risk_level = "HIGH RISK"

        record = {
            "id": record_id,
            "timestamp": timestamp,
            "recipient_email": recipient_email,
            "recipient_name": officer_name,
            "district": "Coimbatore",
            "ward": ward_name,
            "disease": disease_name,
            "risk_level": risk_level,
            "cases": 34,
            "prediction_date": pred_date,
            "delivery_status": "DEMO_VERIFIED",
            "carrier_stage": "SIMULATED_TEST_DISPATCH",
            "delivery_confirmed": False,
            "smtp_server": "Demo Simulator (No SMTP Credentials Required)",
            "status": "demonstration",
            "subject": f"[DEMO OUTBREAK ALERT] High Risk in {ward_name} ({disease_name}) — Coimbatore",
            "recommended_actions": actions,
            "status_note": (
                "Demonstration outbreak email alert generated successfully. "
                "Real SMTP dispatch requires SMTP_USER and SMTP_PASSWORD in backend/.env."
            ),
            "error": None,
            "is_demo": True,
            "is_test": True
        }

        # Save to database and memory history
        try:
            from backend.db import save_email_audit
            save_email_audit(record)
        except Exception as e:
            logger.debug(f"Failed to persist demo email to db: {e}")

        self.dispatch_history.insert(0, record)
        if len(self.dispatch_history) > 100:
            self.dispatch_history.pop()

        logger.info(f"Demonstration email alert generated for {recipient_email} (ID: {record_id})")
        return record

    def get_history(self) -> List[Dict[str, Any]]:
        return self.dispatch_history

    def clear_history(self):
        """Clears email dispatch history from memory and database."""
        self.dispatch_history.clear()
        self.deduplicator.clear()
        try:
            from backend.db import clear_email_audits
            clear_email_audits()
        except Exception:
            pass


email_service = EmailAlertService()
