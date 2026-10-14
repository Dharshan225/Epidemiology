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
} from "lucide-react";
import { api } from "../api/client";

export default function AdminLoginPage({
  currentUser,
  onLoginSuccess,
  onLogout,
  wards = [],
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

  // Direct In-App Fast2SMS Activation State
  const [fast2smsKeyInput, setFast2smsKeyInput] = useState("");
  const [fast2smsRouteInput, setFast2smsRouteInput] = useState("q");
  const [savingGateway, setSavingGateway] = useState(false);
  const [gatewayFeedback, setGatewayFeedback] = useState(null);

  const fetchGatewayInfo = async () => {
    try {
      const gRes = await api.getGatewayStatus();
      setGatewayStatus(gRes);
      const hRes = await api.getSmsHistory();
      if (hRes?.history) setSmsHistory(hRes.history);
    } catch (e) {
      console.warn("Could not fetch gateway info:", e);
    }
  };

  useEffect(() => {
    fetchGatewayInfo();
  }, []);

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
        fetchGatewayInfo();
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
        "Gateway configuration verification test"
      );
      setLastDispatchResult(res);
      fetchGatewayInfo();
    } catch (err) {
      setLastDispatchResult({
        status: "failed",
        delivery_status: "FAILED",
        carrier_stage: "CLIENT_ERROR",
        error: err.message,
      });
    } finally {
      setSmsDispatching(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await api.clearSmsHistory();
      setSmsHistory([]);
      setLastDispatchResult(null);
    } catch (err) {
      console.warn("Could not clear history:", err);
    }
  };

  const handleSaveGatewayConfig = async (e) => {
    e?.preventDefault();
    if (!fast2smsKeyInput.trim()) return;
    setSavingGateway(true);
    setGatewayFeedback(null);
    try {
      const res = await api.configureGateway({
        provider: "fast2sms",
        fast2sms_api_key: fast2smsKeyInput.trim(),
        fast2sms_route: fast2smsRouteInput.trim() || "q",
      });
      setGatewayFeedback({
        success: true,
        message: `Fast2SMS Gateway successfully connected! Live cellular SMS is now active for ${currentUser?.contact_number || contactNumber}.`,
      });
      setFast2smsKeyInput("");
      fetchGatewayInfo();
    } catch (err) {
      setGatewayFeedback({
        success: false,
        message: err.message || "Failed to configure Fast2SMS gateway.",
      });
    } finally {
      setSavingGateway(false);
    }
  };

  const setDemoPreset = (presetName, presetEmail, presetPhone) => {
    setName(presetName);
    setEmail(presetEmail);
    setContactNumber(presetPhone);
    setError(null);
  };

  return (
    <div className="page-content">
      <div className="page-header-block">
        <div>
          <span className="eyebrow-pill">EPIDEMIOLOGY · MUNICIPAL ADMINISTRATION</span>
          <h1 className="page-title">Officer Authentication &amp; Alert Registry</h1>
          <p className="page-subtitle">
            Authenticated administrative portal for Coimbatore Municipal Corporation public health officers.
            Registered contact numbers directly receive real-time cellular SMS notifications when wards enter High Risk.
          </p>
        </div>
      </div>

      <div className="admin-portal-grid">
        {/* Left Column: Login Form or Active Officer Dossier */}
        <div className="panel admin-card">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">
                {currentUser?.is_authenticated ? "Registered Municipal Officer" : "Municipal Officer Login"}
              </h3>
              <p className="panel-desc">
                {currentUser?.is_authenticated
                  ? "Officer verified · Contact number active for high-risk SMS alerts"
                  : "Enter your official email and contact number to access administrative alerts"}
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
                  <strong className="detail-v">{currentUser.email}</strong>
                </div>
                <div className="officer-detail-row alert-target-row">
                  <span className="detail-k"><Phone size={14} /> Alert Contact Number:</span>
                  <strong className="detail-v text-cyan font-mono">{currentUser.contact_number}</strong>
                  <span className="target-pill">Registered for SMS</span>
                </div>
                <div className="officer-detail-row">
                  <span className="detail-k"><Clock size={14} /> Logged In:</span>
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
                  onClick={handleSendTestSms}
                  disabled={smsDispatching}
                  title="Sends a single test SMS to the authorized officer contact number"
                >
                  <Send size={15} />
                  <span>{smsDispatching ? "Transmitting..." : "Send Test SMS to Authorized Officer"}</span>
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. K. Sundaram"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  <Mail size={14} /> Official Email Address
                </label>
                <input
                  type="email"
                  className={`form-input ${!isEmailValid && email ? "input-invalid" : ""}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@coimbatore.gov.in"
                  required
                />
                {!isEmailValid && email && (
                  <span className="form-helper-error">Format must be name@domain.gov.in</span>
                )}
              </div>

              <div className="form-group">
                <label>
                  <Phone size={14} /> Officer Mobile Contact Number
                </label>
                <input
                  type="tel"
                  className={`form-input ${!isPhoneValid && contactNumber ? "input-invalid" : ""}`}
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+919842123456"
                  required
                />
                <span className="form-helper-note">
                  ⚡ This mobile number will receive live SMS alerts whenever a ward is classified as High Risk.
                </span>
                {!isPhoneValid && contactNumber && (
                  <span className="form-helper-error">Valid 10-digit mobile or +91 standard format required</span>
                )}
              </div>

              <div className="form-group">
                <label>
                  <Lock size={14} /> Password / Access PIN
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-login-submit"
                disabled={loading || !isEmailValid || !isPhoneValid}
              >
                <ShieldCheck size={16} />
                <span>{loading ? "Authenticating..." : "Sign In & Register Contact"}</span>
              </button>

              {/* Demo Credentials Quick-Fill for Reviewers */}
              <div className="demo-credentials-strip">
                <span className="demo-title">Quick Demo Officer Profiles:</span>
                <div className="demo-buttons-row">
                  <button
                    type="button"
                    className="btn-demo-preset active-preset"
                    onClick={() => setDemoPreset("Kishore", "24121027@drngpit.ac.in", "+919345791866")}
                  >
                    Kishore — CMHO (+91 93457 91866)
                  </button>
                  <button
                    type="button"
                    className="btn-demo-preset"
                    onClick={() => setDemoPreset("Dr. K. Sundaram", "officer@coimbatore.gov.in", "+919842123456")}
                  >
                    Dr. Sundaram (+91 98421 23456)
                  </button>
                  <button
                    type="button"
                    className="btn-demo-preset"
                    onClick={() => setDemoPreset("Fever Control Desk", "fever.control@tn.gov.in", "+919443078901")}
                  >
                    Fever Desk (+91 94430 78901)
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

        {/* Right Column: SMS Gateway Readiness & Delivery Audit Log */}
        <div className="panel admin-card">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Emergency Alert Notification Service</h3>
              <p className="panel-desc">
                Cellular SMS delivery engine for municipal disease outbreaks
              </p>
            </div>
            <span className={`tag-pill ${gatewayStatus?.is_configured ? "tag-live" : "tag-warn"}`}>
              {gatewayStatus?.is_configured ? "Gateway Connected" : "Gateway Ready / Unconfigured"}
            </span>
          </div>

          {/* Instructions Banner When Unconfigured (Requirement 3) */}
          {!gatewayStatus?.is_configured && (
            <div className="gateway-instructions-banner">
              <div className="instructions-header">
                <AlertTriangle size={18} className="text-amber" />
                <strong>SMS Gateway Configuration Guide</strong>
              </div>
              <p className="instructions-sub">
                To send live cellular SMS alerts to the registered municipal officer, add either <strong>Twilio</strong> or <strong>Fast2SMS</strong> credentials in <code>backend/.env</code>:
              </p>
              
              <div className="instructions-grid">
                <div className="instruction-box">
                  <strong>Option A: Twilio (Cellular SMS)</strong>
                  <p>Add to <code>backend/.env</code>:</p>
                  <pre className="env-code-snippet">
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+1234567890
                  </pre>
                  <small>International &amp; Indian verified cellular numbers.</small>
                </div>

                <div className="instruction-box">
                  <strong>Option B: Fast2SMS (Indian Mobile)</strong>
                  <p>Add to <code>backend/.env</code>:</p>
                  <pre className="env-code-snippet">
FAST2SMS_API_KEY=your_fast2sms_api_key_here
FAST2SMS_ROUTE=q
                  </pre>
                  <small>Standard 10-digit Indian cellular numbers (Route Q).</small>
                </div>
              </div>

              {/* Direct Fast2SMS In-App Activation Form */}
              <div className="quick-gateway-activation-card" style={{ marginTop: "14px", padding: "12px", background: "var(--bg-surface-3)", borderRadius: "8px", border: "1px solid var(--border-medium)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span className="eyebrow-pill" style={{ fontSize: "10px", padding: "2px 6px" }}>QUICK ACTIVATION</span>
                  <strong style={{ fontSize: "12px" }}>Direct Fast2SMS Key Connection</strong>
                </div>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "10px" }}>
                  Paste your Fast2SMS API key below to link cellular alerts to <strong className="font-mono text-cyan">{currentUser?.contact_number || contactNumber}</strong> without manually editing files:
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <input
                    type="password"
                    className="form-input font-mono"
                    style={{ flex: 1, minWidth: "180px", fontSize: "12px", padding: "6px 10px" }}
                    placeholder="Paste Fast2SMS API Key from fast2sms.com"
                    value={fast2smsKeyInput}
                    onChange={(e) => setFast2smsKeyInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary-action"
                    style={{ fontSize: "12px", padding: "6px 14px", height: "auto" }}
                    onClick={handleSaveGatewayConfig}
                    disabled={savingGateway || !fast2smsKeyInput.trim()}
                  >
                    {savingGateway ? "Connecting..." : "Connect Fast2SMS"}
                  </button>
                </div>
                {gatewayFeedback && (
                  <div style={{ marginTop: "8px", fontSize: "11px", color: gatewayFeedback.success ? "var(--emerald-text)" : "var(--red-alert)" }}>
                    {gatewayFeedback.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gateway Status Summary Card */}
          <div className="gateway-status-box">
            <div className="gateway-status-header">
              <Radio size={16} className={gatewayStatus?.is_configured ? "conn-active" : "conn-offline"} />
              <strong>Provider Status: {gatewayStatus?.provider || "None"}</strong>
            </div>
            <p className="gateway-status-note">
              {gatewayStatus?.instructions ||
                "Configure Twilio or Fast2SMS in backend/.env to transmit live cellular alerts."}
            </p>
            <div className="gateway-meta-grid">
              <div className="meta-box">
                <span className="meta-k">Authorized Recipient</span>
                <span className="meta-v font-mono">
                  {currentUser?.contact_number || contactNumber}
                </span>
              </div>
              <div className="meta-box">
                <span className="meta-k">Delivery Stage</span>
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
                  : lastDispatchResult.delivery_status === "GATEWAY_NOT_CONFIGURED"
                  ? "warn"
                  : "failed"
              }`}
            >
              <div className="result-header">
                {lastDispatchResult.delivery_status === "SENT" ? (
                  <CheckCircle2 size={16} className="text-emerald" />
                ) : lastDispatchResult.delivery_status === "GATEWAY_NOT_CONFIGURED" ? (
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
              {lastDispatchResult.message && (
                <p style={{ marginTop: "4px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                  Payload: {lastDispatchResult.message}
                </p>
              )}
              <div className="result-meta">
                <span>Target: <strong>{lastDispatchResult.recipient_phone}</strong></span>
                <span>Wards: <strong>{lastDispatchResult.wards?.join(", ")}</strong></span>
                <span>Date: <strong>{lastDispatchResult.prediction_date || "Today"}</strong></span>
              </div>
            </div>
          )}

          {/* Real Delivery Audit Log Table */}
          <div className="sms-audit-section">
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
                                : item.delivery_status === "GATEWAY_NOT_CONFIGURED"
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
  );
}
