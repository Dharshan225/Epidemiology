import pytest
from datetime import datetime
from unittest.mock import patch, AsyncMock, MagicMock
import httpx
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.sms_service import sms_service
from backend.services.auth_service import auth_service
from backend.services.email_service import email_service
import smtplib

client = TestClient(app)
client.headers["Authorization"] = f"Bearer {auth_service.default_token}"


def test_admin_login_success():
    payload = {
        "email": "officer.coimbatore@health.tn.gov.in",
        "contact_number": "+919842123456",
        "name": "Dr. K. Sundaram"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "authenticated"
    assert data["officer"]["email"] == "officer.coimbatore@health.tn.gov.in"
    assert data["officer"]["contact_number"] == "+919842123456"
    assert data["officer"]["is_authenticated"] is True

def test_admin_login_invalid_email():
    payload = {
        "email": "not-an-email",
        "contact_number": "+919842123456"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 422

def test_admin_login_invalid_phone():
    payload = {
        "email": "officer@coimbatore.gov.in",
        "contact_number": "123"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 422

def test_get_current_officer():
    response = client.get("/api/auth/officer")
    assert response.status_code == 200
    data = response.json()
    assert "email" in data
    assert "contact_number" in data
    assert "name" in data

def test_gateway_not_configured_delivery_status():
    """
    Verify that dispatch returns GATEWAY_NOT_CONFIGURED or FAILED when no real credentials exist.
    Strictly verifies non-simulation: status MUST NOT be 'delivered' and delivery_status MUST NOT be 'SENT'
    without provider confirmation.
    """
    sms_service.deduplicator.clear()
    payload = {
        "recipient_phone": "+919842123456",
        "recipient_name": "Dr. K. Sundaram",
        "disease": "Dengue",
        "force": True
    }
    response = client.post("/api/alerts/dispatch-sms", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    # Check valid status enum: SENT, FAILED, or GATEWAY_NOT_CONFIGURED
    assert data["delivery_status"] in ("SENT", "FAILED", "GATEWAY_NOT_CONFIGURED")
    if data["delivery_status"] != "SENT":
        assert data["status"] in ("failed", "unconfigured")
        assert data["delivery_status"] in ("GATEWAY_NOT_CONFIGURED", "FAILED")
        assert data.get("provider_id") is None

def test_message_content_contains_required_fields():
    """
    Requirement 6: Message must include:
    - ward name
    - risk level
    - prediction date
    - recommended preventive action
    """
    sms_service.deduplicator.clear()
    payload = {
        "recipient_phone": "+919842123456",
        "recipient_name": "Dr. K. Sundaram",
        "disease": "Dengue",
        "prediction_date": "2026-10-15",
        "force": True
    }
    response = client.post("/api/alerts/dispatch-sms", json=payload)
    assert response.status_code == 200
    data = response.json()
    msg = data.get("message", "")
    
    # 1. Ward name present
    assert any(w in msg for w in ["Ward 01", "Ward 02", "Ward"])
    # 2. Risk level present
    assert "HIGH" in msg
    # 3. Prediction date present
    assert "2026-10-15" in msg
    # 4. Recommended preventive action present
    assert any(act in msg.lower() for act in ["vector control", "larvicide", "action"])

def test_duplicate_alert_prevention():
    """
    Requirement 7: Prevent duplicate alerts for the same ward, risk level, and date.
    Subsequent attempt within cooldown must be flagged as duplicate unless force=True.
    """
    sms_service.deduplicator.clear()
    today_date = "2026-10-16"
    
    # Simulate a recorded dispatch in deduplicator
    sms_service.deduplicator.record_dispatch("Ward 01", "High", today_date)
    
    # Second dispatch without force must be prevented as duplicate
    payload = {
        "recipient_phone": "+919842123456",
        "recipient_name": "Dr. K. Sundaram",
        "disease": "Dengue",
        "prediction_date": today_date,
        "force": False
    }
    response = client.post("/api/alerts/dispatch-sms", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_duplicate"] is True
    assert "Duplicate alert prevented" in data["error"]
    
    # Force dispatch should bypass duplicate check
    payload_force = {**payload, "force": True}
    response_force = client.post("/api/alerts/dispatch-sms", json=payload_force)
    assert response_force.status_code == 200
    data_force = response_force.json()
    assert data_force["is_duplicate"] is False

def test_prevent_repeated_attempts_when_unconfigured():
    """
    Requirement 7: Prevent repeated SMS attempts when the gateway is not configured.
    Verifies that calling evaluate-thresholds or consecutive dispatches when unconfigured
    does NOT endlessly bloat the dispatch history log with duplicate unconfigured rows.
    """
    sms_service.clear_history()
    # Call evaluate-thresholds when unconfigured
    response = client.post("/api/alerts/evaluate-thresholds?disease=Dengue")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "gateway_unconfigured"
    assert data["alerts_dispatched"] == 0
    
    # History should remain clean and not spammed with duplicate unconfigured attempts
    history_res = client.get("/api/alerts/sms-history").json()
    assert len(history_res["history"]) == 0

def test_test_sms_endpoint():
    """
    Requirement 4: When unconfigured, allow demonstration test SMS to authorized recipient.
    Honest status DEMO_VERIFIED or GATEWAY_NOT_CONFIGURED or SENT.
    """
    response = client.post("/api/alerts/test-sms", json={"note": "Connectivity verification test"})
    assert response.status_code == 200
    data = response.json()
    assert data["delivery_status"] in ("SENT", "GATEWAY_NOT_CONFIGURED", "FAILED", "DEMO_VERIFIED")
    if data["delivery_status"] == "DEMO_VERIFIED":
        assert data["carrier_stage"] == "SIMULATED_TEST_DISPATCH"
        assert data["delivery_confirmed"] is False
        assert ("Ward 10" in data["ward"] or "Ward 07" in data["ward"] or
                "Ward 10" in data["message"] or "Ward 07" in data["message"])

def test_clear_sms_history_endpoint():
    """Verify that DELETE /api/alerts/sms-history clears the audit history cleanly."""
    # Seed an entry
    client.post("/api/alerts/dispatch-sms", json={"recipient_phone": "+919842123456", "force": True})
    # Clear
    del_res = client.delete("/api/alerts/sms-history")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "cleared"
    
    # Check history is 0
    get_res = client.get("/api/alerts/sms-history")
    assert len(get_res.json()["history"]) == 0

def test_gateway_status_no_secrets_leaked():
    """Verify that credentials are NEVER exposed in the gateway status API."""
    response = client.get("/api/alerts/gateway-status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "delivery_status" in data
    assert "provider" in data
    # Ensure raw secret keys are completely absent from response keys and values
    assert "twilio_auth_token" not in data
    assert "fast2sms_api_key" not in data
    assert "account_sid" not in data
    assert "auth_token" not in data

def test_test_sms_unauthorized_recipient():
    """
    Test SMS must reject unauthorized phone numbers not matching the registered municipal officer.
    """
    response = client.post("/api/alerts/test-sms", json={"recipient_phone": "+919999999999", "note": "Unauthorized recipient test"})
    assert response.status_code == 200
    data = response.json()
    assert data["delivery_status"] == "FAILED"
    assert data["carrier_stage"] == "UNAUTHORIZED_RECIPIENT"
    assert "Unauthorized recipient" in data["error"]

def test_fast2sms_success_mock():
    """
    Verify successful Fast2SMS dispatch:
    - Provider acceptance (return: True)
    - Records request_id
    - Distinguishes provider acceptance (delivery_confirmed=False) from confirmed delivery
    - Carrier stage is SUBMITTED_TO_CARRIER
    - Delivery status is SENT
    """
    mock_creds = {
        "twilio_account_sid": "",
        "twilio_auth_token": "",
        "twilio_from_number": "",
        "fast2sms_api_key": "test_f2s_valid_secret_key",
        "fast2sms_route": "q",
        "sms_provider": "fast2sms",
    }
    mock_f2s_resp = MagicMock()
    mock_f2s_resp.status_code = 200
    mock_f2s_resp.json.return_value = {
        "return": True,
        "request_id": "fast2sms_req_99812",
        "message": ["SMS sent successfully."]
    }

    with patch.object(sms_service, "get_credentials", return_value=mock_creds):
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_f2s_resp
            response = client.post("/api/alerts/test-sms", json={"note": "Single test SMS"})
            assert response.status_code == 200
            data = response.json()
            assert data["delivery_status"] == "SENT"
            assert data["carrier_stage"] == "SUBMITTED_TO_CARRIER"
            assert data["delivery_confirmed"] is False
            assert data["provider_id"] == "fast2sms_req_99812"
            assert data["provider_response"]["request_id"] == "fast2sms_req_99812"
            assert data["provider_response"]["return"] is True
            # Never expose credentials in response
            assert "test_f2s_valid_secret_key" not in str(data)

def test_fast2sms_invalid_api_key_mock():
    """Verify Fast2SMS invalid API key (HTTP 401) is handled cleanly."""
    mock_creds = {
        "twilio_account_sid": "",
        "twilio_auth_token": "",
        "twilio_from_number": "",
        "fast2sms_api_key": "bad_key",
        "fast2sms_route": "q",
        "sms_provider": "fast2sms",
    }
    mock_f2s_resp = MagicMock()
    mock_f2s_resp.status_code = 401
    mock_f2s_resp.json.return_value = {
        "return": False,
        "status_code": 401,
        "message": "Invalid Authorization Key"
    }

    with patch.object(sms_service, "get_credentials", return_value=mock_creds):
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_f2s_resp
            response = client.post("/api/alerts/test-sms", json={"note": "Test invalid key"})
            assert response.status_code == 200
            data = response.json()
            assert data["delivery_status"] == "FAILED"
            assert data["carrier_stage"] == "INVALID_API_KEY"
            assert "Invalid Authorization Key" in data["error"] or "401" in data["error"]

def test_fast2sms_insufficient_balance_mock():
    """Verify Fast2SMS insufficient balance (status_code 412) is classified."""
    mock_creds = {
        "twilio_account_sid": "",
        "twilio_auth_token": "",
        "twilio_from_number": "",
        "fast2sms_api_key": "test_f2s_key",
        "fast2sms_route": "q",
        "sms_provider": "fast2sms",
    }
    mock_f2s_resp = MagicMock()
    mock_f2s_resp.status_code = 412
    mock_f2s_resp.json.return_value = {
        "return": False,
        "status_code": 412,
        "message": "Insufficient Balance"
    }

    with patch.object(sms_service, "get_credentials", return_value=mock_creds):
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_f2s_resp
            response = client.post("/api/alerts/test-sms", json={"note": "Test balance check"})
            assert response.status_code == 200
            data = response.json()
            assert data["delivery_status"] == "FAILED"
            assert data["carrier_stage"] == "INSUFFICIENT_BALANCE"
            assert "Insufficient Balance" in data["error"]

def test_fast2sms_rejected_request_mock():
    """Verify Fast2SMS rejected request (e.g. invalid mobile number) is handled."""
    mock_creds = {
        "twilio_account_sid": "",
        "twilio_auth_token": "",
        "twilio_from_number": "",
        "fast2sms_api_key": "test_f2s_key",
        "fast2sms_route": "q",
        "sms_provider": "fast2sms",
    }
    mock_f2s_resp = MagicMock()
    mock_f2s_resp.status_code = 400
    mock_f2s_resp.json.return_value = {
        "return": False,
        "status_code": 400,
        "message": "Invalid Mobile Number"
    }

    with patch.object(sms_service, "get_credentials", return_value=mock_creds):
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_f2s_resp
            response = client.post("/api/alerts/test-sms", json={"note": "Test rejected"})
            assert response.status_code == 200
            data = response.json()
            assert data["delivery_status"] == "FAILED"
            assert data["carrier_stage"] == "PROVIDER_REJECTED"
            assert data["provider_response"]["status_code"] == 400

def test_fast2sms_network_error_mock():
    """Verify network connection timeout or failure is recorded properly."""
    mock_creds = {
        "twilio_account_sid": "",
        "twilio_auth_token": "",
        "twilio_from_number": "",
        "fast2sms_api_key": "test_f2s_key",
        "fast2sms_route": "q",
        "sms_provider": "fast2sms",
    }

    with patch.object(sms_service, "get_credentials", return_value=mock_creds):
        with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("Failed to resolve host")):
            response = client.post("/api/alerts/test-sms", json={"note": "Test network error"})
            assert response.status_code == 200
            data = response.json()
            assert data["delivery_status"] == "FAILED"
            assert data["carrier_stage"] == "NETWORK_ERROR"
            assert "Network connection failure" in data["error"]

def test_configure_gateway_endpoint():
    """Verify in-app gateway configuration endpoint."""
    with patch.object(sms_service, "update_env_file") as mock_update:
        res = client.post("/api/alerts/configure-gateway", json={
            "provider": "fast2sms",
            "fast2sms_api_key": "test_live_key",
            "fast2sms_route": "q"
        })
        assert res.status_code == 200
        mock_update.assert_called_once_with({"FAST2SMS_API_KEY": "test_live_key", "FAST2SMS_ROUTE": "q"})
        data = res.json()
        assert "validation" in data

def test_email_not_configured_delivery_status():
    """Verify dispatch-email returns SMTP_NOT_CONFIGURED and never simulates success."""
    email_service.deduplicator.clear()
    with patch.object(email_service, "get_credentials", return_value={
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_user": "",
        "smtp_password": "",
        "smtp_from_email": "",
        "smtp_use_tls": True
    }):
        payload = {
            "recipient_email": "24121027@drngpit.ac.in",
            "ward": "Ward 07 (Gandhipuram)",
            "disease": "Dengue",
            "risk_level": "HIGH RISK",
            "force": True
        }
        res = client.post("/api/alerts/dispatch-email", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["delivery_status"] == "SMTP_NOT_CONFIGURED"
        assert data["delivery_confirmed"] is False
        assert data["status"] != "delivered"

def test_email_content_contains_required_fields():
    """Verify built email contains district, ward, disease, risk level, date, and actions."""
    text_body, html_body = email_service.build_email_content(
        district="Coimbatore",
        ward="Ward 07 (Gandhipuram)",
        disease="Dengue",
        risk_level="HIGH RISK",
        prediction_date="2026-10-15",
        recommended_actions=[
            "Thermal ULV fogging in residential blocks",
            "Abate larviciding in overhead tanks"
        ],
        cases=34,
        recipient_name="Kishore"
    )
    for body in [text_body, html_body]:
        assert "Coimbatore" in body
        assert "Ward 07 (Gandhipuram)" in body
        assert "Dengue" in body
        assert "HIGH RISK" in body
        assert "2026-10-15" in body
        assert "Thermal ULV fogging" in body
        assert "Abate larviciding" in body

def test_test_email_unauthorized_recipient():
    """Verify test-email cannot be sent to arbitrary unauthorized third-party emails."""
    res = client.post("/api/alerts/test-email", json={
        "recipient_email": "stranger@external.com",
        "note": "Illegal email"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "unauthorized"
    assert data["delivery_status"] == "FAILED"
    assert data["delivery_confirmed"] is False
    assert "Unauthorized recipient" in data["error"]

def test_smtp_authentication_failure_handling():
    """Verify SMTP authentication failure reports accurate status without fake success."""
    mock_creds = {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_user": "officer@gmail.com",
        "smtp_password": "bad_password",
        "smtp_from_email": "officer@gmail.com",
        "smtp_use_tls": True
    }
    with patch.object(email_service, "get_credentials", return_value=mock_creds):
        with patch("smtplib.SMTP") as mock_smtp_cls:
            mock_server = MagicMock()
            mock_server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"5.7.8 Username and Password not accepted")
            mock_smtp_cls.return_value = mock_server

            res = client.post("/api/alerts/test-email", json={"note": "Test auth failure"})
            assert res.status_code == 200
            data = res.json()
            assert data["delivery_status"] == "SMTP_AUTHENTICATION_FAILED"
            assert data["delivery_confirmed"] is False
            assert "SMTP Authentication failed" in data["error"]

def test_smtp_status_no_secrets_leaked():
    """Verify /api/alerts/smtp-status endpoint reports status without leaking password."""
    res = client.get("/api/alerts/smtp-status")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "smtp_host" in data
    assert "smtp_port" in data
    assert "smtp_password" not in data

def test_evaluate_thresholds_with_email_dispatch():
    """Verify scanning thresholds triggers genuine email alert for high-risk wards."""
    res = client.post("/api/alerts/evaluate-thresholds?disease=Dengue&force=true")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "evaluated"
    assert "email_results" in data
    assert data["high_risk_wards_count"] > 0
    assert len(data["email_results"]) > 0
    first_res = data["email_results"][0]
    assert first_res["disease"] == "Dengue"
    assert first_res["risk_level"] == "HIGH RISK"
    assert first_res["recipient_email"] is not None


def test_test_email_demo_mode_when_unconfigured():
    """
    Requirement 3 & 5: When SMTP is unconfigured, 'Send Test Email to Officer'
    generates a demonstration outbreak alert with required fields and honest status.
    """
    email_service.clear_history()
    with patch.object(email_service, "get_credentials", return_value={
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_user": "",
        "smtp_password": "",
        "smtp_from_email": "",
        "smtp_use_tls": True
    }):
        res = client.post("/api/alerts/test-email", json={"note": "Demo email click"})
        assert res.status_code == 200
        data = res.json()
        assert data["delivery_status"] == "DEMO_VERIFIED"
        assert data["carrier_stage"] == "SIMULATED_TEST_DISPATCH"
        assert data["delivery_confirmed"] is False
        assert data["is_demo"] is True
        assert data["district"] == "Coimbatore"
        assert ("Ward 10" in data["ward"] or "Ward 07" in data["ward"])
        assert "Dengue" in data["disease"]
        assert "HIGH RISK" in data["risk_level"]
        assert len(data["recommended_actions"]) > 0
        assert "prediction_date" in data
        assert "timestamp" in data
        assert "Demo Simulator" in data["smtp_server"]


def test_test_sms_repeated_clicks_persists_in_db():
    """
    Requirement 5 & 6: Repeated clicks on 'Send Test SMS to Officer' with the same officer
    must generate a separate audit record for each click, persisted in SQLite database.
    """
    sms_service.clear_history()
    from backend.db import get_sms_audits

    # Click 1
    res1 = client.post("/api/alerts/test-sms", json={"note": "Click 1"})
    assert res1.status_code == 200
    d1 = res1.json()

    # Click 2 (same recipient)
    res2 = client.post("/api/alerts/test-sms", json={"note": "Click 2"})
    assert res2.status_code == 200
    d2 = res2.json()

    # Click 3 (same recipient)
    res3 = client.post("/api/alerts/test-sms", json={"note": "Click 3"})
    assert res3.status_code == 200
    d3 = res3.json()

    # Must have distinct IDs
    assert d1["id"] != d2["id"]
    assert d2["id"] != d3["id"]

    # History endpoint must have all 3
    hist_res = client.get("/api/alerts/sms-history")
    assert hist_res.status_code == 200
    history = hist_res.json()["history"]
    assert len(history) >= 3

    # Database must persist all 3
    db_rows = get_sms_audits(50)
    db_ids = [r["id"] for r in db_rows]
    assert d1["id"] in db_ids
    assert d2["id"] in db_ids
    assert d3["id"] in db_ids


def test_test_email_repeated_clicks_persists_in_db():
    """
    Requirement 5 & 6: Repeated clicks on 'Send Test Email to Officer' with the same officer
    must generate a separate audit record for each click, persisted in SQLite database.
    """
    email_service.clear_history()
    from backend.db import get_email_audits

    # Click 1
    res1 = client.post("/api/alerts/test-email", json={"note": "Click 1"})
    assert res1.status_code == 200
    d1 = res1.json()

    # Click 2 (same recipient)
    res2 = client.post("/api/alerts/test-email", json={"note": "Click 2"})
    assert res2.status_code == 200
    d2 = res2.json()

    # Click 3 (same recipient)
    res3 = client.post("/api/alerts/test-email", json={"note": "Click 3"})
    assert res3.status_code == 200
    d3 = res3.json()

    # Must have distinct IDs
    assert d1["id"] != d2["id"]
    assert d2["id"] != d3["id"]

    # History endpoint must have all 3
    hist_res = client.get("/api/alerts/email-history")
    assert hist_res.status_code == 200
    history = hist_res.json()["history"]
    assert len(history) >= 3

    # Database must persist all 3
    db_rows = get_email_audits(50)
    db_ids = [r["id"] for r in db_rows]
    assert d1["id"] in db_ids
    assert d2["id"] in db_ids
    assert d3["id"] in db_ids


def test_demo_alerts_honest_status_no_fake_delivery_claim():
    """
    Requirement 8: Demo mode must clearly distinguish simulated alerts from actual delivery.
    delivery_confirmed must be False, delivery_status must be DEMO_VERIFIED,
    and status_note must clearly explain demo mode without claiming real delivery.
    """
    sms_res = client.post("/api/alerts/test-sms")
    sms_data = sms_res.json()
    assert sms_data["delivery_confirmed"] is False
    assert sms_data["delivery_status"] == "DEMO_VERIFIED"
    assert "Real cellular delivery requires" in sms_data["status_note"] or "demo" in sms_data["status_note"].lower()

    email_res = client.post("/api/alerts/test-email")
    email_data = email_res.json()
    assert email_data["delivery_confirmed"] is False
    assert email_data["delivery_status"] == "DEMO_VERIFIED"
    assert "Real SMTP dispatch requires" in email_data["status_note"] or "demo" in email_data["status_note"].lower()


def test_real_smtp_dispatch_when_configured():
    """
    Requirement 9: Preserve existing real email delivery when SMTP is configured.
    """
    mock_creds = {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_user": "verified_officer@gmail.com",
        "smtp_password": "valid_app_password",
        "smtp_from_email": "verified_officer@gmail.com",
        "smtp_use_tls": True
    }
    with patch.object(email_service, "get_credentials", return_value=mock_creds):
        with patch("smtplib.SMTP") as mock_smtp_cls:
            mock_server = MagicMock()
            mock_smtp_cls.return_value = mock_server

            res = client.post("/api/alerts/test-email", json={"note": "Real SMTP test"})
            assert res.status_code == 200
            data = res.json()
            assert data["delivery_status"] == "SENT"
            assert data["delivery_confirmed"] is True
            assert mock_server.sendmail.called


