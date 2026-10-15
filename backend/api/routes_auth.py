import logging
import re
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field

from backend.services.auth_service import auth_service
from backend.services.sms_service import sms_service
from backend.services.email_service import email_service
from backend.services.data_service import data_service
from backend.api.deps import get_current_officer

logger = logging.getLogger("epidemiology.api.auth")
router = APIRouter(prefix="/api", tags=["Admin Authentication & Alert Notifications"])


class AdminLoginRequest(BaseModel):
    email: str = Field(..., description="Municipal officer email address", json_schema_extra={"example": "officer@coimbatore.gov.in"})
    contact_number: str = Field(..., description="Registered contact number for alert dispatches", json_schema_extra={"example": "+919842123456"})
    name: Optional[str] = Field(None, description="Officer display name", json_schema_extra={"example": "Dr. K. Sundaram"})
    password: Optional[str] = Field(None, description="Admin password or PIN")


class DispatchSmsRequest(BaseModel):
    recipient_phone: Optional[str] = Field(None, description="Optional override contact number; defaults to registered officer number")
    recipient_name: Optional[str] = Field(None, description="Optional override officer name")
    disease: Optional[str] = Field("Dengue", description="Target disease for alert")
    custom_message: Optional[str] = Field(None, description="Custom message text override")
    prediction_date: Optional[str] = Field(None, description="Date associated with prediction / outbreak alert")
    force: Optional[bool] = Field(False, description="Set True to bypass duplicate alert suppression")


class DispatchEmailRequest(BaseModel):
    recipient_email: Optional[str] = Field(None, description="Optional override officer email; defaults to registered officer email")
    recipient_name: Optional[str] = Field(None, description="Optional override officer name")
    district: Optional[str] = Field("Coimbatore", description="District name")
    ward: Optional[str] = Field(None, description="Ward name")
    disease: Optional[str] = Field("Dengue", description="Disease name")
    risk_level: Optional[str] = Field("HIGH RISK", description="Risk level")
    cases: Optional[int] = Field(None, description="Reported or predicted case count")
    prediction_date: Optional[str] = Field(None, description="Forecast date")
    recommended_actions: Optional[List[str]] = Field(None, description="List of recommended municipal actions")
    force: Optional[bool] = Field(False, description="Set True to bypass duplicate suppression")


class TestSmsRequest(BaseModel):
    recipient_phone: Optional[str] = Field(None, description="Optional recipient phone number; defaults to authorized municipal officer")
    note: Optional[str] = Field(None, description="Optional test note")


class TestEmailRequest(BaseModel):
    recipient_email: Optional[str] = Field(None, description="Optional recipient email; defaults to authorized municipal officer")
    note: Optional[str] = Field(None, description="Optional test note")


class ConfigureGatewayRequest(BaseModel):
    provider: str = Field("fast2sms", description="Provider: fast2sms or twilio")
    fast2sms_api_key: Optional[str] = Field(None, description="Fast2SMS API authorization key")
    fast2sms_route: Optional[str] = Field("q", description="Fast2SMS route: q or v3")
    twilio_account_sid: Optional[str] = Field(None, description="Twilio Account SID")
    twilio_auth_token: Optional[str] = Field(None, description="Twilio Auth Token")
    twilio_from_number: Optional[str] = Field(None, description="Twilio From Number")


class ConfigureSmtpRequest(BaseModel):
    smtp_host: str = Field("smtp.gmail.com", description="SMTP server hostname")
    smtp_port: int = Field(587, description="SMTP port (587 for TLS, 465 for SSL)")
    smtp_user: str = Field(..., description="SMTP account username / email")
    smtp_password: str = Field(..., description="SMTP password or Gmail App Password")
    smtp_from_email: Optional[str] = Field(None, description="Sender from address")
    smtp_use_tls: bool = Field(True, description="Whether to use STARTTLS")


# ==============================================================================
# AUTHENTICATION ENDPOINTS
# ==============================================================================

@router.post("/auth/login", status_code=status.HTTP_200_OK)
async def admin_login(payload: AdminLoginRequest):
    """
    Authenticate municipal officer with email ID and contact number.
    Generates a secure session token to protect dashboard endpoints.
    """
    try:
        officer = auth_service.authenticate(
            email=payload.email,
            contact_number=payload.contact_number,
            name=payload.name,
            password=payload.password
        )
        return {
            "status": "authenticated",
            "message": f"Welcome, {officer['name']}. Authorized session token created.",
            "token": officer["token"],
            "officer": officer
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Login failure: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during authentication."
        )


@router.get("/auth/officer", status_code=status.HTTP_200_OK)
async def get_current_officer_endpoint(officer: Dict[str, Any] = Depends(get_current_officer)):
    """Returns currently authenticated municipal officer profile and alert contact info."""
    return officer


@router.post("/auth/logout", status_code=status.HTTP_200_OK)
async def admin_logout(officer: Dict[str, Any] = Depends(get_current_officer)):
    """Logs out the active municipal officer session and invalidates token."""
    auth_service.logout(officer.get("token"))
    return {"status": "logged_out", "message": "Officer logged out successfully."}


# ==============================================================================
# EMAIL ALERT NOTIFICATION ENDPOINTS
# ==============================================================================

@router.post("/alerts/dispatch-email", status_code=status.HTTP_200_OK)
async def dispatch_high_risk_email_alert(
    payload: Optional[DispatchEmailRequest] = None,
    officer: Dict[str, Any] = Depends(get_current_officer)
):
    """
    Sends genuine high-risk outbreak email notification to the registered municipal officer.
    Strictly preserves truth in delivery status:
    - Never simulates successful email delivery.
    - Accurately reports SENT, SMTP_NOT_CONFIGURED, or SMTP_AUTHENTICATION_FAILED.
    """
    target_email = payload.recipient_email if payload and payload.recipient_email else officer.get("email")
    target_name = payload.recipient_name if payload and payload.recipient_name else officer.get("name", "Chief Municipal Health Officer")
    district = payload.district if payload and payload.district else "Coimbatore"
    ward = payload.ward if payload and payload.ward else "Ward 07 (Gandhipuram)"
    disease = payload.disease if payload and payload.disease else "Dengue"
    risk_level = payload.risk_level if payload and payload.risk_level else "HIGH RISK"
    cases = payload.cases if payload and payload.cases is not None else 34
    prediction_date = payload.prediction_date if payload else None
    actions = payload.recommended_actions if payload else None
    force = payload.force if payload and payload.force is not None else False

    result = await email_service.dispatch_high_risk_email(
        recipient_email=target_email,
        recipient_name=target_name,
        district=district,
        ward=ward,
        disease=disease,
        risk_level=risk_level,
        cases=cases,
        prediction_date=prediction_date,
        recommended_actions=actions,
        force=force
    )
    return result


@router.post("/alerts/test-email", status_code=status.HTTP_200_OK)
async def send_single_test_email(
    payload: Optional[TestEmailRequest] = None,
    officer: Dict[str, Any] = Depends(get_current_officer)
):
    """
    Sends a single test email alert to the authorized municipal officer to verify SMTP setup.
    Strictly validates that recipient matches the authorized officer.
    """
    officer_email = officer.get("email")
    requested_email = payload.recipient_email if payload and payload.recipient_email else officer_email
    officer_name = officer.get("name", "Chief Municipal Health Officer")

    # Verify recipient is authorized
    if requested_email and requested_email.strip().lower() != officer_email.strip().lower():
        return {
            "status": "unauthorized",
            "delivery_status": "FAILED",
            "carrier_stage": "UNAUTHORIZED_RECIPIENT",
            "delivery_confirmed": False,
            "recipient_email": requested_email,
            "error": f"Unauthorized recipient: Test emails can only be sent to the registered municipal officer ({officer_email}).",
            "smtp_server": None
        }

    return await email_service.dispatch_test_email(
        recipient_email=officer_email,
        recipient_name=officer_name,
        note=payload.note if payload else None
    )


@router.get("/alerts/email-history", status_code=status.HTTP_200_OK)
async def get_email_dispatch_history(officer: Dict[str, Any] = Depends(get_current_officer)):
    """Returns actual email delivery audit trail with confirmed delivery statuses."""
    smtp_info = email_service.validate_smtp()
    return {
        "smtp_server": f"{smtp_info['smtp_host']}:{smtp_info['smtp_port']}",
        "is_configured": smtp_info["configured"],
        "delivery_status": "READY" if smtp_info["configured"] else "SMTP_NOT_CONFIGURED",
        "registered_officer_email": officer.get("email"),
        "history": email_service.get_history(),
        "total_dispatched": len(email_service.get_history())
    }


@router.delete("/alerts/email-history", status_code=status.HTTP_200_OK)
async def clear_email_dispatch_history(officer: Dict[str, Any] = Depends(get_current_officer)):
    """Clears the email dispatch audit history."""
    email_service.clear_history()
    return {
        "status": "cleared",
        "message": "Email audit history cleared successfully.",
        "history": []
    }


@router.get("/alerts/smtp-status", status_code=status.HTTP_200_OK)
async def get_smtp_status(officer: Dict[str, Any] = Depends(get_current_officer)):
    """Returns SMTP configuration readiness without exposing secrets."""
    validation = email_service.validate_smtp()
    return {
        "status": "ready" if validation["configured"] else "unconfigured",
        "delivery_status": "READY" if validation["configured"] else "SMTP_NOT_CONFIGURED",
        "smtp_host": validation["smtp_host"],
        "smtp_port": validation["smtp_port"],
        "smtp_user": validation["smtp_user"],
        "is_configured": validation["configured"],
        "registered_officer": officer,
        "instructions": validation.get("instructions")
    }


@router.post("/alerts/configure-smtp", status_code=status.HTTP_200_OK)
async def configure_smtp(
    payload: ConfigureSmtpRequest,
    officer: Dict[str, Any] = Depends(get_current_officer)
):
    """
    Saves SMTP credentials to backend/.env and re-validates the gateway.
    Allows municipal officers to activate real email delivery directly from portal.
    """
    if not payload.smtp_user or not payload.smtp_user.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="SMTP User/Email cannot be empty.")
    if not payload.smtp_password or not payload.smtp_password.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="SMTP Password cannot be empty.")

    updates = {
        "SMTP_HOST": payload.smtp_host.strip(),
        "SMTP_PORT": str(payload.smtp_port),
        "SMTP_USER": payload.smtp_user.strip(),
        "SMTP_PASSWORD": payload.smtp_password.strip(),
        "SMTP_FROM_EMAIL": (payload.smtp_from_email or payload.smtp_user).strip(),
        "SMTP_USE_TLS": "True" if payload.smtp_use_tls else "False",
    }
    email_service.update_env_file(updates)
    validation = email_service.validate_smtp()
    return {
        "status": "configured" if validation["configured"] else "unconfigured",
        "delivery_status": validation["delivery_status"],
        "smtp_host": validation["smtp_host"],
        "smtp_port": validation["smtp_port"],
        "is_configured": validation["configured"],
        "message": f"SMTP configuration updated for {validation['smtp_user']}.",
        "validation": validation
    }


# ==============================================================================
# CELLULAR SMS ALERT NOTIFICATION ENDPOINTS
# ==============================================================================

@router.post("/alerts/dispatch-sms", status_code=status.HTTP_200_OK)
async def dispatch_high_risk_sms_alert(
    payload: Optional[DispatchSmsRequest] = None,
    officer: Dict[str, Any] = Depends(get_current_officer)
):
    """Sends emergency cellular SMS notification to the registered municipal officer."""
    target_phone = (payload.recipient_phone if payload and payload.recipient_phone else officer.get("contact_number"))
    target_name = (payload.recipient_name if payload and payload.recipient_name else officer.get("name", "Chief Municipal Health Officer"))
    disease = payload.disease if payload and payload.disease else "Dengue"
    custom_message = payload.custom_message if payload else None
    prediction_date = payload.prediction_date if payload else None
    force = payload.force if payload and payload.force is not None else False

    raw_wards = data_service.get_wards()
    all_wards = [w.model_dump() if hasattr(w, "model_dump") else (w.dict() if hasattr(w, "dict") else dict(w)) for w in raw_wards]
    high_risk_wards = [w for w in all_wards if w.get("risk") == "High"]
    if not high_risk_wards:
        high_risk_wards = [w for w in all_wards if w.get("cases", 0) >= 24]
    if not high_risk_wards:
        high_risk_wards = [w for w in all_wards if w.get("cases", 0) >= 15]

    result = await sms_service.dispatch_high_risk_alert(
        officer_phone=target_phone,
        officer_name=target_name,
        high_risk_wards=high_risk_wards,
        disease=disease,
        custom_message=custom_message,
        prediction_date=prediction_date,
        force=force,
        is_automated=False
    )
    return result


@router.post("/alerts/test-sms", status_code=status.HTTP_200_OK)
async def send_single_test_sms(
    payload: Optional[TestSmsRequest] = None,
    officer: Dict[str, Any] = Depends(get_current_officer)
):
    """Sends a single test SMS to authorized municipal officer contact number."""
    officer_phone = officer.get("contact_number")
    requested_phone = (payload.recipient_phone if payload and payload.recipient_phone else officer_phone)
    officer_name = officer.get("name", "Chief Municipal Health Officer")

    officer_digits = re.sub(r"[^\d]", "", officer_phone or "")[-10:]
    requested_digits = re.sub(r"[^\d]", "", requested_phone or "")[-10:]
    if officer_digits and requested_digits and officer_digits != requested_digits:
        return {
            "status": "unauthorized",
            "delivery_status": "FAILED",
            "carrier_stage": "UNAUTHORIZED_RECIPIENT",
            "delivery_confirmed": False,
            "recipient_phone": requested_phone,
            "error": f"Unauthorized recipient: Test SMS can only be sent to the registered municipal officer ({officer_phone}).",
            "provider_response": None
        }

    return await sms_service.dispatch_test_sms(
        officer_phone=officer_phone,
        officer_name=officer_name,
        note=payload.note if payload else None
    )


@router.post("/alerts/evaluate-thresholds", status_code=status.HTTP_200_OK)
async def evaluate_thresholds_and_dispatch(
    disease: str = "Dengue",
    force: bool = False,
    officer: Dict[str, Any] = Depends(get_current_officer)
):
    """
    Scans all monitored municipal wards against predefined high-risk thresholds:
    (cases >= 24 or composite risk score >= 65.0).
    Dispatches:
    1. Genuine EMAIL alerts to registered municipal officer with district, ward, disease,
       risk level, prediction date, and recommended municipal intervention actions.
    2. Cellular SMS alerts to registered contact number.
    Never simulates delivery. Returns confirmed delivery statuses.
    """
    raw_wards = data_service.get_wards()
    all_wards = [w.model_dump() if hasattr(w, "model_dump") else (w.dict() if hasattr(w, "dict") else dict(w)) for w in raw_wards]
    high_risk_wards = [w for w in all_wards if w.get("risk") == "High" or w.get("cases", 0) >= 24]
    if not high_risk_wards:
        high_risk_wards = [w for w in all_wards if w.get("cases", 0) >= 15]

    officer_email = officer.get("email")
    officer_name = officer.get("name", "Chief Municipal Health Officer")

    sms_validation = sms_service.validate_gateway()
    email_validation = email_service.validate_smtp()

    # Suppress repeated automatic attempts when gateways are unconfigured
    if not sms_validation["configured"] and not email_validation["configured"] and not force:
        return {
            "status": "gateway_unconfigured",
            "delivery_status": "GATEWAY_NOT_CONFIGURED",
            "message": "Alert gateways not configured in backend/.env. Automated repeated attempts suppressed.",
            "disease": disease,
            "alerts_dispatched": 0,
            "high_risk_wards_count": len(high_risk_wards),
            "email_results": [],
            "sms_results": [],
            "results": []
        }

    # 1. Dispatch Email alerts for each High Risk ward
    email_results = []
    for hw in high_risk_wards:
        ward_name = hw.get("name", "Monitored Municipal Ward")
        cases = hw.get("cases", 0)
        res = await email_service.dispatch_high_risk_email(
            recipient_email=officer_email,
            recipient_name=officer_name,
            district="Coimbatore",
            ward=ward_name,
            disease=disease,
            risk_level="HIGH RISK",
            cases=cases,
            force=force
        )
        email_results.append(res)

    # 2. Dispatch Cellular SMS alert
    sms_validation = sms_service.validate_gateway()
    sms_results = []
    if sms_validation["configured"]:
        sms_results = await sms_service.check_and_alert_thresholds(disease=disease, force=force)

    return {
        "status": "evaluated",
        "disease": disease,
        "high_risk_wards_count": len(high_risk_wards),
        "email_alerts_attempted": len(email_results),
        "email_results": email_results,
        "sms_results": sms_results,
    }


@router.get("/alerts/sms-history", status_code=status.HTTP_200_OK)
async def get_sms_dispatch_history(officer: Dict[str, Any] = Depends(get_current_officer)):
    """Returns actual SMS delivery audit trail and real statuses."""
    gateway_info = sms_service.validate_gateway()
    return {
        "gateway": gateway_info["provider"],
        "is_configured": gateway_info["configured"],
        "delivery_status": "READY" if gateway_info["configured"] else "GATEWAY_NOT_CONFIGURED",
        "registered_officer_phone": officer.get("contact_number"),
        "history": sms_service.get_history(),
        "total_dispatched": len(sms_service.get_history())
    }


@router.delete("/alerts/sms-history", status_code=status.HTTP_200_OK)
async def clear_sms_dispatch_history(officer: Dict[str, Any] = Depends(get_current_officer)):
    """Clears the SMS dispatch history log."""
    sms_service.clear_history()
    return {
        "status": "cleared",
        "message": "SMS audit history cleared successfully.",
        "history": []
    }


@router.get("/alerts/gateway-status", status_code=status.HTTP_200_OK)
async def get_gateway_status(officer: Dict[str, Any] = Depends(get_current_officer)):
    """Returns SMS gateway configuration readiness without leaking secrets."""
    validation = sms_service.validate_gateway()
    creds = sms_service.get_credentials()
    has_twilio = bool(creds["twilio_account_sid"] and creds["twilio_auth_token"])
    has_fast2sms = bool(creds["fast2sms_api_key"])
    
    return {
        "status": "ready" if validation["configured"] else "unconfigured",
        "delivery_status": "READY" if validation["configured"] else "GATEWAY_NOT_CONFIGURED",
        "provider": validation["provider"],
        "twilio_configured": has_twilio,
        "fast2sms_configured": has_fast2sms,
        "registered_officer": officer,
        "instructions": (
            "To enable live cellular SMS dispatch, configure Twilio or Fast2SMS credentials in backend/.env."
        ) if not validation["configured"] else f"SMS Gateway ({validation['provider']}) is active.",
        "config_instructions": sms_service.get_configuration_instructions() if not validation["configured"] else None
    }


@router.post("/alerts/configure-gateway", status_code=status.HTTP_200_OK)
async def configure_gateway(
    payload: ConfigureGatewayRequest,
    officer: Dict[str, Any] = Depends(get_current_officer)
):
    """Saves SMS gateway credentials to backend/.env and re-validates the gateway."""
    updates = {}
    provider_name = payload.provider.lower().strip()
    if provider_name == "fast2sms":
        if not payload.fast2sms_api_key or not payload.fast2sms_api_key.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="FAST2SMS_API_KEY cannot be empty.")
        updates["FAST2SMS_API_KEY"] = payload.fast2sms_api_key.strip()
        updates["FAST2SMS_ROUTE"] = (payload.fast2sms_route or "q").strip()
    elif provider_name == "twilio":
        if not payload.twilio_account_sid or not payload.twilio_auth_token or not payload.twilio_from_number:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Twilio SID, Auth Token, and From Number are required.")
        updates["TWILIO_ACCOUNT_SID"] = payload.twilio_account_sid.strip()
        updates["TWILIO_AUTH_TOKEN"] = payload.twilio_auth_token.strip()
        updates["TWILIO_FROM_NUMBER"] = payload.twilio_from_number.strip()
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unsupported provider '{payload.provider}'.")

    sms_service.update_env_file(updates)
    validation = sms_service.validate_gateway()
    return {
        "status": "configured" if validation["configured"] else "unconfigured",
        "provider": validation["provider"],
        "delivery_status": validation["delivery_status"],
        "message": f"Gateway updated to {validation['provider']}.",
        "validation": validation,
    }
