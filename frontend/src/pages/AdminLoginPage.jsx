import React, { useState, useEffect } from "react";
import {
  UserCheck,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Send,
  LogOut,
  CheckCircle2,
  XCircle,
  Clock,
  Key,
  Building,
  Server,
  RefreshCw,
} from "lucide-react";
import { api } from "../api/client";

export default function AdminLoginPage({
  currentUser,
  onLoginSuccess,
  onLogout,
  wards = [],
  isStandalone = false,
}) {
  const [email, setEmail] = useState(currentUser?.email || "24121027@drngpit.ac.in");
  const [contactNumber, setContactNumber] = useState(currentUser?.contact_number || "+919345791866");
  const [name, setName] = useState(currentUser?.name || "Kishore");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // SMS Gateway state
  const [gatewayStatus, setGatewayStatus] = useState(null);
  const [smsHistory, setSmsHistory] = useState([]);
  const [smsDispatching, setSmsDispatching] = useState(false);
  const [lastDispatchResult, setLastDispatchResult] = useState(null);

  // SMTP Email Gateway state
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [emailHistory, setEmailHistory] = useState([]);
  const [emailDispatching, setEmailDispatching] = useState(false);
  const [lastEmailResult, setLastEmailResult] = useState(null);

  // Direct In-App Fast2SMS Activation State
  const [fast2smsKeyInput, setFast2smsKeyInput] = useState("");
  const [fast2smsRouteInput, setFast2smsRouteInput] = useState("q");
  const [savingGateway, setSavingGateway] = useState(false);
  const [gatewayFeedback, setGatewayFeedback] = useState(null);

  // Direct In-App SMTP Activation State
  const [smtpHostInput, setSmtpHostInput] = useState("smtp.gmail.com");
  const [smtpPortInput, setSmtpPortInput] = useState("587");
  const [smtpUserInput, setSmtpUserInput] = useState("");
  const [smtpPasswordInput, setSmtpPasswordInput] = useState("");
  const [smtpUseTlsInput, setSmtpUseTlsInput] = useState(true);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState(null);

  const fetchAlertGatewaysInfo = async () => {
    try {
      const gRes = await api.getGatewayStatus().catch(() => null);
      if (gRes) setGatewayStatus(gRes);
      const hRes = await api.getSmsHistory().catch(() => null);
      if (hRes?.history) setSmsHistory(hRes.history);

      const sRes = await api.getSmtpStatus().catch(() => null);
      if (sRes) setSmtpStatus(sRes);
      const eRes = await api.getEmailHistory().catch(() => null);
      if (eRes?.history) setEmailHistory(eRes.history);
    } catch (e) {
      console.warn("Could not fetch gateway info:", e);
    }
  };

  useEffect(() => {
    fetchAlertGatewaysInfo();
  }, [currentUser]);

  // Validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const cleanPhone = contactNumber.replace(/[\s\-\(\)]/g, "");
  const isPhoneValid = /^(\+91|0)?[6-9]\d{9}$/.test(cleanPhone) || /^\+[1-9]\d{7,14}$/.test(cleanPhone);

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!isEmailValid) {
      setError("Please provide a valid official email address.");
      return;
    }
    if (!isPhoneValid) {
      setError("Please provide a valid 10-digit mobile number or +91 standard format.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.loginAdmin({
        email: email.trim(),
        contact_number: contactNumber.trim(),
        name: name.trim(),
        password,
      });

      if (res?.officer) {
        setSuccessMsg(`Authenticated successfully as ${res.officer.name}.`);
        onLoginSuccess?.(res.officer);
        fetchAlertGatewaysInfo();
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Check details.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestSms = async () => {
    setSmsDispatching(true);
    setLastDispatchResult(null);
    try {
      const res = await api.sendTestSms(
        currentUser?.contact_number || contactNumber,
        "Single verification test transmission initiated from Officer Portal."
      );
      setLastDispatchResult(res);
      const hRes = await api.getSmsHistory();
      if (hRes?.history) setSmsHistory(hRes.history);
    } catch (err) {
      setLastDispatchResult({
        status: "failed",
        delivery_status: "FAILED",
        error: err.message,
      });
    } finally {
      setSmsDispatching(false);
    }
  };

  const handleSendTestEmail = async () => {
    setEmailDispatching(true);
    setLastEmailResult(null);
    try {
      const res = await api.sendTestEmail(
        currentUser?.email || email,
        "Single verification test dispatch from Officer Portal."
      );
      setLastEmailResult(res);
      const eRes = await api.getEmailHistory();
      if (eRes?.history) setEmailHistory(eRes.history);
    } catch (err) {
      setLastEmailResult({
        status: "failed",
        delivery_status: "FAILED",
        delivery_confirmed: false,
        error: err.message,
      });
    } finally {
      setEmailDispatching(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await api.clearSmsHistory();
      setSmsHistory([]);
    } catch (e) {
      console.warn("Could not clear SMS history:", e);
    }
  };

  const handleClearEmailHistory = async () => {
    try {
      await api.clearEmailHistory();
      setEmailHistory([]);
    } catch (e) {
      console.warn("Could not clear Email history:", e);
    }
  };

  const handleSaveGatewayConfig = async (e) => {
    e?.preventDefault();
    if (!fast2smsKeyInput.trim()) {
      setGatewayFeedback({ success: false, message: "Please paste a valid Fast2SMS API key." });
      return;
    }
    setSavingGateway(true);
    setGatewayFeedback(null);
    try {
      const res = await api.configureGateway({
        provider: "fast2sms",
        fast2sms_api_key: fast2smsKeyInput.trim(),
        fast2sms_route: fast2smsRouteInput.trim() || "q",
      });
      setGatewayFeedback({ success: true, message: res.message || "Fast2SMS activated successfully!" });
      setFast2smsKeyInput("");
      fetchAlertGatewaysInfo();
    } catch (err) {
      setGatewayFeedback({ success: false, message: err.message || "Failed to configure gateway." });
    } finally {
      setSavingGateway(false);
    }
  };

  const handleSaveSmtpConfig = async (e) => {
    e?.preventDefault();
    if (!smtpUserInput.trim() || !smtpPasswordInput.trim()) {
      setSmtpFeedback({ success: false, message: "SMTP user email and password are required." });
      return;
    }
    setSavingSmtp(true);
    setSmtpFeedback(null);
    try {
      const res = await api.configureSmtp({
        smtp_host: smtpHostInput.trim() || "smtp.gmail.com",
        smtp_port: parseInt(smtpPortInput, 10) || 587,
        smtp_user: smtpUserInput.trim(),
        smtp_password: smtpPasswordInput.trim(),
        smtp_use_tls: smtpUseTlsInput,
      });
      setSmtpFeedback({ success: true, message: res.message || "SMTP configuration saved to backend/.env." });
      setSmtpPasswordInput("");
      fetchAlertGatewaysInfo();
    } catch (err) {
      setSmtpFeedback({ success: false, message: err.message || "Failed to save SMTP configuration." });
    } finally {
      setSavingSmtp(false);
    }
  };

  const setDemoPreset = (presetName, presetEmail, presetPhone) => {
    setName(presetName);
    setEmail(presetEmail);
    setContactNumber(presetPhone);
    setError(null);
  };

  return (
    <div className={`page-content ${isStandalone ? "login-standalone-page" : ""}`}>
      <div className="page-header-block">
        <div>
          <span className="eyebrow-pill">EPIDEMIOLOGY · MUNICIPAL ADMINISTRATION</span>
          <h1 className="page-title">
            {currentUser?.is_authenticated ? "Officer Portal & Alert Registry" : "Municipal Officer Authentication"}
          </h1>
          <p className="page-subtitle">
            Authenticated administrative portal for Coimbatore Municipal Corporation public health officers.
            Only authorized officers can access epidemiological surveillance data and receive real-time outbreak alerts.
          </p>
        </div>
      </div>

      <div className="admin-portal-grid">
        {/* Left Column: Login Form or Active Officer Dossier */}
        <div className="panel admin-card">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">
                {currentUser?.is_authenticated ? "Registered Municipal Officer" : "Officer Login"}
              </h3>
              <p className="panel-desc">
                {currentUser?.is_authenticated
                  ? "Officer verified · Authorized for automated SMS and Email outbreak alerts"
                  : "Sign in with your official municipal credentials to access the surveillance dashboard"}
              </p>
            </div>
            {currentUser?.is_authenticated && (
              <span className="tag-pill tag-live">Active Session</span>
            )}
          </div>

          {currentUser?.is_authenticated ? (
            <div className="officer-profile-card">
              <div className="officer-hero">
                <div className="officer-avatar-box">
                  <UserCheck size={32} className="text-cyan" />
                </div>
                <div>
                  <h3 className="officer-display-name">{currentUser.name}</h3>
                  <p className="officer-role">{currentUser.role || "Chief Municipal Health Officer"}</p>
                  <p className="officer-sub-text">
                    <Building size={12} /> {currentUser.jurisdiction || "Coimbatore Municipal Corporation"}
                  </p>
                </div>
              </div>

              <div className="officer-details-list">
                <div className="officer-detail-row">
                  <span className="detail-k"><Mail size={14} /> Official Email:</span>
                  <strong className="detail-v text-cyan font-mono">{currentUser.email}</strong>
                  <span className="target-pill">Target for Email Alerts</span>
                </div>
                <div className="officer-detail-row alert-target-row">
                  <span className="detail-k"><Phone size={14} /> Alert Contact Number:</span>
                  <strong className="detail-v text-cyan font-mono">{currentUser.contact_number}</strong>
                  <span className="target-pill">Target for SMS Alerts</span>
                </div>
                <div className="officer-detail-row">
                  <span className="detail-k"><Clock size={14} /> Session Active:</span>
                  <span className="detail-v text-muted">
                    {new Date(currentUser.logged_in_at).toLocaleString()}
                  </span>
                </div>
                <div className="officer-detail-row">
                  <span className="detail-k"><Key size={14} /> Session Token:</span>
                  <code className="session-token-code">{currentUser.token}</code>
                </div>
              </div>

              <div className="officer-action-buttons">
                <button
                  className="btn-primary-action"
                  onClick={handleSendTestEmail}
                  disabled={emailDispatching}
                  title="Sends a genuine test email to the authorized officer email"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                >
                  <Mail size={15} />
                  <span>{emailDispatching ? "Transmitting..." : "Send Test Email to Officer"}</span>
                </button>
                <button
                  className="btn-primary-action"
                  onClick={handleSendTestSms}
                  disabled={smsDispatching}
                  title="Sends a single test SMS to the authorized officer contact number"
                >
                  <Send size={15} />
                  <span>{smsDispatching ? "Transmitting..." : "Send Test SMS to Officer"}</span>
                </button>
                <button className="btn-secondary-action" onClick={onLogout}>
                  <LogOut size={15} />
                  <span>Log Out Session</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="admin-login-form">
              {error && (
                <div className="login-alert-box error">
                  <AlertTriangle size={15} />
                  <span>{error}</span>
                </div>
              )}
              {successMsg && (
                <div className="login-alert-box success">
                  <CheckCircle2 size={15} />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="form-group">
                <label>
                  <UserCheck size={14} /> Officer Full Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Kishore"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  <Mail size={14} /> Official Email ID (Receives High-Risk Alerts)
                </label>
                <input
                  type="email"
                  className={`form-input ${email && !isEmailValid ? "input-invalid" : ""}`}
                  placeholder="24121027@drngpit.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {!isEmailValid && email && (
                  <span className="form-helper-error">Valid official email address is required.</span>
                )}
              </div>

              <div className="form-group">
                <label>
                  <Phone size={14} /> Officer Mobile Contact Number (Receives SMS Alerts)
                </label>
                <input
                  type="tel"
                  className={`form-input font-mono ${contactNumber && !isPhoneValid ? "input-invalid" : ""}`}
                  placeholder="+919345791866"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  required
                />
                {!isPhoneValid && contactNumber && (
                  <span className="form-helper-error">Must be a valid 10-digit mobile number or +91 standard format.</span>
                )}
              </div>

              <div className="form-group">
                <label>
                  <Lock size={14} /> Password / Administrative Security PIN
                </label>
                <input
                  type="password"
                  className="form-input font-mono"
                  placeholder="Admin@123"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn-login-submit"
                disabled={loading || !isEmailValid || !isPhoneValid}
              >
                <ShieldCheck size={16} />
                <span>{loading ? "Authenticating..." : "Sign In & Access Dashboard"}</span>
              </button>

              {/* Quick Demo Credentials */}
              <div className="demo-credentials-box">
                <span className="demo-title">Quick Demo Officer Profiles:</span>
                <div className="demo-presets-list">
                  <button
                    type="button"
                    className="btn-demo-preset"
                    onClick={() => setDemoPreset("Kishore", "24121027@drngpit.ac.in", "+919345791866")}
                  >
                    Kishore (CMHO · 24121027@drngpit.ac.in)
                  </button>
                  <button
                    type="button"
                    className="btn-demo-preset"
                    onClick={() => setDemoPreset("Dr. K. Sundaram", "officer@coimbatore.gov.in", "+919842123456")}
                  >
                    Dr. K. Sundaram (Zonal Officer)
                  </button>
                </div>
              </div>

              {/* Instant Login Shortcut */}
              <div className="guest-explore-box" style={{ marginTop: "16px", textAlign: "center" }}>
                <button
                  type="button"
                  className="btn-guest-explore"
                  onClick={() => onLoginSuccess?.({
                    name: "Kishore",
                    role: "Chief Municipal Health Officer",
                    jurisdiction: "Coimbatore Municipal Corporation (District 3331)",
                    email: "24121027@drngpit.ac.in",
                    contact_number: "+919345791866",
                    department: "Public Health & Epidemic Surveillance Division",
                    token: "officer-token-f0d0d9073de6b0fa7932ffe9b4f9c7b2",
                    is_authenticated: true,
                    logged_in_at: new Date().toISOString(),
                  })}
                  title="One-click authentication as Chief Municipal Health Officer Kishore"
                >
                  <span>⚡ Instant Login as Kishore &amp; Open Dashboard &rarr;</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: Outbreak Notification Gateways (Email & SMS) */}
        <div className="admin-portal-column">
          {/* EMAIL ALERT GATEWAY CARD */}
          <div className="panel admin-card" style={{ marginBottom: "20px" }}>
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Email Outbreak Notification Gateway (SMTP)</h3>
                <p className="panel-desc">
                  Dispatches genuine email alerts with district, ward, disease, and recommended actions
                </p>
              </div>
              <span className={`tag-pill ${smtpStatus?.is_configured ? "tag-live" : "tag-warn"}`}>
                {smtpStatus?.is_configured ? "SMTP Connected" : "SMTP Unconfigured"}
              </span>
            </div>

            {/* SMTP Instructions Banner When Unconfigured */}
            {!smtpStatus?.is_configured && (
              <div className="gateway-instructions-banner">
                <div className="instructions-header">
                  <AlertTriangle size={18} className="text-amber" />
                  <strong>SMTP Email Configuration Required</strong>
                </div>
                <p className="instructions-sub">
                  To send live outbreak alert emails to <strong>{currentUser?.email || email}</strong>, configure SMTP credentials in <code>backend/.env</code> or connect below:
                </p>
                <div className="instructions-grid">
                  <div className="instruction-box" style={{ width: "100%" }}>
                    <strong>Gmail SMTP Setup (Recommended)</strong>
                    <p>Add to <code>backend/.env</code>:</p>
                    <pre className="env-code-snippet">
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_16_char_app_password
SMTP_USE_TLS=True
                    </pre>
                    <small>Generate App Password at: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: "var(--cyan-primary)" }}>https://myaccount.google.com/apppasswords</a></small>
                  </div>
                </div>

                {/* Direct In-App SMTP Activation Form */}
                <div className="quick-gateway-activation-card" style={{ marginTop: "14px", padding: "12px", background: "var(--bg-surface-3)", borderRadius: "8px", border: "1px solid var(--border-medium)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span className="eyebrow-pill" style={{ fontSize: "10px", padding: "2px 6px" }}>QUICK SMTP SETUP</span>
                    <strong style={{ fontSize: "12px" }}>Direct SMTP Connection</strong>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                    <input
                      type="text"
                      className="form-input font-mono"
                      placeholder="SMTP Host (e.g. smtp.gmail.com)"
                      value={smtpHostInput}
                      onChange={(e) => setSmtpHostInput(e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input font-mono"
                      placeholder="Port (e.g. 587)"
                      value={smtpPortInput}
                      onChange={(e) => setSmtpPortInput(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                    <input
                      type="email"
                      className="form-input font-mono"
                      placeholder="SMTP User Email"
                      value={smtpUserInput}
                      onChange={(e) => setSmtpUserInput(e.target.value)}
                    />
                    <input
                      type="password"
                      className="form-input font-mono"
                      placeholder="SMTP App Password"
                      value={smtpPasswordInput}
                      onChange={(e) => setSmtpPasswordInput(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-primary-action"
                    style={{ fontSize: "12px", padding: "6px 14px", height: "auto" }}
                    onClick={handleSaveSmtpConfig}
                    disabled={savingSmtp || !smtpUserInput.trim() || !smtpPasswordInput.trim()}
                  >
                    {savingSmtp ? "Saving..." : "Connect SMTP Gateway"}
                  </button>
                  {smtpFeedback && (
                    <div style={{ marginTop: "8px", fontSize: "11px", color: smtpFeedback.success ? "var(--emerald-text)" : "var(--red-alert)" }}>
                      {smtpFeedback.message}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SMTP Status Summary Box */}
            <div className="gateway-status-box">
              <div className="gateway-status-header">
                <Server size={16} className={smtpStatus?.is_configured ? "conn-active" : "conn-offline"} />
                <strong>Server: {smtpStatus?.smtp_host || "smtp.gmail.com"}:{smtpStatus?.smtp_port || 587}</strong>
              </div>
              <div className="gateway-meta-grid">
                <div className="meta-box">
                  <span className="meta-k">Authorized Recipient</span>
                  <span className="meta-v font-mono">{currentUser?.email || email}</span>
                </div>
                <div className="meta-box">
                  <span className="meta-k">Delivery Status</span>
                  <span className="meta-v text-cyan font-mono">
                    {smtpStatus?.delivery_status || "SMTP_NOT_CONFIGURED"}
                  </span>
                </div>
              </div>
            </div>

            {/* Last Email Dispatch Result Callout */}
            {lastEmailResult && (
              <div
                className={`dispatch-result-card ${
                  lastEmailResult.delivery_status === "SENT"
                    ? "success"
                    : lastEmailResult.delivery_status === "SMTP_NOT_CONFIGURED" || lastEmailResult.delivery_status === "DEMO_VERIFIED"
                    ? "warn"
                    : "failed"
                }`}
                style={{ marginTop: "12px" }}
              >
                <div className="result-header">
                  {lastEmailResult.delivery_status === "SENT" ? (
                    <CheckCircle2 size={16} className="text-emerald" />
                  ) : lastEmailResult.delivery_status === "SMTP_NOT_CONFIGURED" || lastEmailResult.delivery_status === "DEMO_VERIFIED" ? (
                    <AlertTriangle size={16} className="text-amber" />
                  ) : (
                    <XCircle size={16} className="text-red" />
                  )}
                  <strong>Email Status: {lastEmailResult.delivery_status}</strong>
                  {lastEmailResult.carrier_stage && (
                    <span className="carrier-stage-tag">{lastEmailResult.carrier_stage}</span>
                  )}
                </div>
                <p className="result-desc">
                  {lastEmailResult.error ||
                    lastEmailResult.status_note ||
                    `Email alert successfully confirmed and delivered to ${lastEmailResult.recipient_email}.`}
                </p>
                <div className="result-meta">
                  <span>Target: <strong>{lastEmailResult.recipient_email}</strong></span>
                  <span>Disease: <strong>{lastEmailResult.disease || "Dengue"}</strong></span>
                  <span>Date: <strong>{lastEmailResult.prediction_date || "Today"}</strong></span>
                </div>
              </div>
            )}

            {/* Email Delivery Audit Log Table */}
            <div className="sms-audit-section" style={{ marginTop: "16px" }}>
              <div className="audit-header">
                <div>
                  <h4>Email Outbreak Alerts Audit Log</h4>
                  <span className="audit-count">{emailHistory.length} Dispatches Recorded</span>
                </div>
                {emailHistory.length > 0 && (
                  <button
                    type="button"
                    className="btn-clear-log"
                    onClick={handleClearEmailHistory}
                  >
                    Clear Log
                  </button>
                )}
              </div>

              {emailHistory.length === 0 ? (
                <div className="empty-audit-state">
                  <p>No email alerts dispatched yet in this surveillance cycle.</p>
                  <small>When high-risk thresholds trigger or test emails are sent, confirmed delivery statuses record here.</small>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="surveillance-table sms-table">
                    <thead>
                      <tr>
                        <th>Time (UTC)</th>
                        <th>Recipient Email</th>
                        <th>Ward / Subject</th>
                        <th>Delivery Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailHistory.map((item) => (
                        <tr key={item.id}>
                          <td>{new Date(item.timestamp).toLocaleTimeString()}</td>
                          <td className="font-mono">{item.recipient_email}</td>
                          <td className="text-muted" style={{ fontSize: "11px" }}>
                            {item.ward || "High Risk Ward Alert"}
                          </td>
                          <td>
                            <span
                              className={`sms-status-pill ${
                                item.delivery_status === "SENT"
                                  ? "pill-delivered"
                                  : item.delivery_status === "SMTP_NOT_CONFIGURED" || item.delivery_status === "DEMO_VERIFIED"
                                  ? "pill-warn"
                                  : "pill-failed"
                              }`}
                              title={item.error || item.status_note || "Delivery recorded"}
                            >
                              {item.delivery_status || "FAILED"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* CELLULAR SMS GATEWAY CARD */}
          <div className="panel admin-card">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Cellular SMS Alert Service</h3>
                <p className="panel-desc">
                  Emergency cellular SMS engine (Twilio / Fast2SMS) for field officer alerts
                </p>
              </div>
              <span className={`tag-pill ${gatewayStatus?.is_configured ? "tag-live" : "tag-warn"}`}>
                {gatewayStatus?.is_configured ? "SMS Connected" : "SMS Ready / Unconfigured"}
              </span>
            </div>

            {/* Gateway Status Summary Card */}
            <div className="gateway-status-box">
              <div className="gateway-status-header">
                <Radio size={16} className={gatewayStatus?.is_configured ? "conn-active" : "conn-offline"} />
                <strong>Provider: {gatewayStatus?.provider || "None"}</strong>
              </div>
              <div className="gateway-meta-grid">
                <div className="meta-box">
                  <span className="meta-k">Authorized Recipient</span>
                  <span className="meta-v font-mono">{currentUser?.contact_number || contactNumber}</span>
                </div>
                <div className="meta-box">
                  <span className="meta-k">Delivery Status</span>
                  <span className="meta-v text-cyan">
                    {gatewayStatus?.is_configured ? "Ready for Carrier Dispatch" : "GATEWAY_NOT_CONFIGURED"}
                  </span>
                </div>
              </div>
            </div>

            {/* Last Dispatch Result Callout */}
            {lastDispatchResult && (
              <div
                className={`dispatch-result-card ${
                  lastDispatchResult.delivery_status === "SENT"
                    ? "success"
                    : lastDispatchResult.delivery_status === "GATEWAY_NOT_CONFIGURED" || lastDispatchResult.delivery_status === "DEMO_VERIFIED"
                    ? "warn"
                    : "failed"
                }`}
                style={{ marginTop: "12px" }}
              >
                <div className="result-header">
                  {lastDispatchResult.delivery_status === "SENT" ? (
                    <CheckCircle2 size={16} className="text-emerald" />
                  ) : lastDispatchResult.delivery_status === "GATEWAY_NOT_CONFIGURED" || lastDispatchResult.delivery_status === "DEMO_VERIFIED" ? (
                    <AlertTriangle size={16} className="text-amber" />
                  ) : (
                    <XCircle size={16} className="text-red" />
                  )}
                  <strong>Delivery Status: {lastDispatchResult.delivery_status}</strong>
                  {lastDispatchResult.carrier_stage && (
                    <span className="carrier-stage-tag">{lastDispatchResult.carrier_stage}</span>
                  )}
                </div>
                <p className="result-desc">
                  {lastDispatchResult.error ||
                    lastDispatchResult.status_note ||
                    `Message successfully dispatched to carrier for ${lastDispatchResult.recipient_phone}. SID: ${lastDispatchResult.provider_id}`}
                </p>
                <div className="result-meta">
                  <span>Target: <strong>{lastDispatchResult.recipient_phone}</strong></span>
                  <span>Wards: <strong>{lastDispatchResult.wards?.join(", ")}</strong></span>
                  <span>Date: <strong>{lastDispatchResult.prediction_date || "Today"}</strong></span>
                </div>
              </div>
            )}

            {/* Real Delivery Audit Log Table */}
            <div className="sms-audit-section" style={{ marginTop: "16px" }}>
              <div className="audit-header">
                <div>
                  <h4>SMS Delivery Audit Log</h4>
                  <span className="audit-count">{smsHistory.length} Attempts Recorded</span>
                </div>
                {smsHistory.length > 0 && (
                  <button
                    type="button"
                    className="btn-clear-log"
                    onClick={handleClearHistory}
                    title="Clear past attempts from audit history"
                  >
                    Clear Log
                  </button>
                )}
              </div>

              {smsHistory.length === 0 ? (
                <div className="empty-audit-state">
                  <p>No SMS alerts dispatched yet in this surveillance cycle.</p>
                  <small>Once gateway credentials are added in backend/.env, test SMS dispatches will record here.</small>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="surveillance-table sms-table">
                    <thead>
                      <tr>
                        <th>Time (UTC)</th>
                        <th>Recipient</th>
                        <th>Carrier Stage</th>
                        <th>Delivery Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {smsHistory.map((item) => (
                        <tr key={item.id}>
                          <td>{new Date(item.timestamp).toLocaleTimeString()}</td>
                          <td className="font-mono">{item.recipient_phone}</td>
                          <td className="text-muted" style={{ fontSize: "11px" }}>
                            {item.carrier_stage || "CARRIER_STAGE_RECORDED"}
                          </td>
                          <td>
                            <span
                              className={`sms-status-pill ${
                                item.delivery_status === "SENT" || item.status === "delivered" || item.status === "submitted"
                                  ? "pill-delivered"
                                  : item.delivery_status === "GATEWAY_NOT_CONFIGURED" || item.delivery_status === "DEMO_VERIFIED"
                                  ? "pill-warn"
                                  : "pill-failed"
                              }`}
                              title={item.error || item.status_note || "Sent to telecom provider"}
                            >
                              {item.delivery_status || (item.status === "delivered" ? "SENT" : "FAILED")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
