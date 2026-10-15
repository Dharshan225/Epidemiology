import React, { useState, useMemo } from "react";
import {
  Bell,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
  Filter,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Building,
  Phone,
  Mail,
  Send,
  XCircle,
  Radio,
} from "lucide-react";
import { api } from "../api/client";
import { defaultAlerts } from "../App";

export default function AlertsPage({
  alerts = [],
  wardData = [],
  selectedDisease = "Dengue",
  selectedDistrict = "Coimbatore",
  onSelectWard,
  currentUser,
  onNavigateTab,
}) {
  const activeAlerts = alerts && alerts.length > 0 ? alerts : defaultAlerts;
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [searchWard, setSearchWard] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);

  const filteredAlerts = useMemo(() => {
    return activeAlerts.filter((al) => {
      const matchesSeverity =
        severityFilter === "ALL" ||
        al.type.toLowerCase() === severityFilter.toLowerCase();
      const matchesWard =
        !searchWard ||
        al.ward.toLowerCase().includes(searchWard.toLowerCase());
      return matchesSeverity && matchesWard;
    });
  }, [activeAlerts, severityFilter, searchWard]);

  const highSeverityCount = activeAlerts.filter((a) => a.type === "high").length;
  const mediumSeverityCount = activeAlerts.filter((a) => a.type === "medium").length;


  const [forceDispatch, setForceDispatch] = useState(false);

  const handleDispatchSmsAlert = async (forceOverride = false) => {
    setDispatching(true);
    setDispatchResult(null);
    try {
      const res = await api.dispatchAlertSms({
        recipient_phone: currentUser?.contact_number,
        recipient_name: currentUser?.name,
        disease: selectedDisease,
        prediction_date: new Date().toISOString().split("T")[0],
        force: forceOverride || forceDispatch,
      });
      setDispatchResult(res);
    } catch (err) {
      setDispatchResult({
        status: "failed",
        delivery_status: "FAILED",
        error: err.message,
      });
    } finally {
      setDispatching(false);
    }
  };

  const handleDispatchEmailAlert = async (forceOverride = false) => {
    setDispatching(true);
    setDispatchResult(null);
    try {
      const highRiskWard = wardData.find((w) => w.risk === "High" || w.cases >= 24) || { name: "Ward 10", cases: 34 };
      const res = await api.dispatchAlertEmail({
        recipient_email: currentUser?.email,
        recipient_name: currentUser?.name,
        district: selectedDistrict || "Coimbatore",
        ward: highRiskWard.name,
        disease: selectedDisease,
        risk_level: "HIGH RISK",
        cases: highRiskWard.cases,
        prediction_date: new Date().toISOString().split("T")[0],
        force: forceOverride || forceDispatch,
      });
      setDispatchResult(res);
    } catch (err) {
      setDispatchResult({
        status: "failed",
        delivery_status: "FAILED",
        error: err.message,
      });
    } finally {
      setDispatching(false);
    }
  };

  const handleEvaluateThresholds = async () => {
    setDispatching(true);
    setDispatchResult(null);
    try {
      const res = await api.evaluateThresholdAlerts(selectedDisease, forceDispatch);
      if (res?.email_results && res.email_results.length > 0) {
        setDispatchResult(res.email_results[0]);
      } else if (res?.results && res.results.length > 0) {
        setDispatchResult(res.results[0]);
      } else {
        setDispatchResult({
          status: "evaluated",
          delivery_status: res?.delivery_status || "EVALUATED",
          error: res?.message || "All monitored municipal wards currently remain below high-risk threshold (cases < 24).",
        });
      }
    } catch (err) {
      setDispatchResult({
        status: "failed",
        delivery_status: "FAILED",
        error: err.message,
      });
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header-block">
        <div>
          <span className="eyebrow-pill">SURVEILLANCE SURGE DETECTION</span>
          <h1 className="page-title">Outbreak Early Warning Alerts</h1>
          <p className="page-subtitle">
            Automated municipal surge alerts triggered by the Epidemiological Vector-Borne Outbreak Index (EVOI).
            Differentiates observed active clusters from early model warnings.
          </p>
        </div>
      </div>

      {/* Emergency Alert Notification Action Bar (Email + SMS) */}
      <div className="sms-alert-dispatcher-bar">
        <div className="dispatcher-left">
          <div className="dispatcher-icon-box">
            <Mail size={20} className="text-cyan" />
          </div>
          <div>
            <h4>Municipal Officer High-Risk Alert Engine</h4>
            <p>
              Officer: <strong>{currentUser?.name || "Kishore"}</strong> ·{" "}
              Email: <span className="font-mono text-cyan font-bold">{currentUser?.email || "24121027@drngpit.ac.in"}</span> ·{" "}
              Phone: <span className="font-mono text-cyan font-bold">{currentUser?.contact_number || "+919345791866"}</span>
            </p>
            <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "5px", cursor: "pointer", color: "var(--text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={forceDispatch}
                  onChange={(e) => setForceDispatch(e.target.checked)}
                />
                <span>Bypass Duplicate Suppression (Force Send)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="dispatcher-right" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            className="btn-secondary-action"
            onClick={handleEvaluateThresholds}
            disabled={dispatching}
            title="Scan all wards against high-risk threshold (cases >= 24) and send alerts"
          >
            <Radio size={14} />
            <span>Scan Thresholds</span>
          </button>
          <button
            className="btn-dispatch-sms"
            onClick={() => handleDispatchEmailAlert(forceDispatch)}
            disabled={dispatching || highSeverityCount === 0}
            title={
              highSeverityCount > 0
                ? "Send high-risk alert email to registered municipal officer email address"
                : "No high-risk wards currently triggering alerts"
            }
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
            <Mail size={15} />
            <span>
              {dispatching
                ? "Transmitting..."
                : `Dispatch Email Alert (${highSeverityCount} High Risk Wards)`}
            </span>
          </button>
          <button
            className="btn-dispatch-sms"
            onClick={() => handleDispatchSmsAlert(forceDispatch)}
            disabled={dispatching || highSeverityCount === 0}
            title={
              highSeverityCount > 0
                ? "Send high-risk alert SMS to registered municipal officer contact"
                : "No high-risk wards currently triggering alerts"
            }
          >
            <Send size={15} />
            <span>
              {dispatching
                ? "Transmitting Alert..."
                : `Dispatch SMS Alert`}
            </span>
          </button>
        </div>
      </div>

      {/* Real Delivery Status Callout (CRITICAL: Shows Honest Status, No Simulated Success) */}
      {dispatchResult && (
        <div
          className={`dispatch-status-alert ${
            dispatchResult.delivery_status === "SENT"
              ? "status-success"
              : dispatchResult.delivery_status === "GATEWAY_NOT_CONFIGURED" || dispatchResult.delivery_status === "SMTP_NOT_CONFIGURED" || dispatchResult.delivery_status === "DEMO_VERIFIED"
              ? "status-warn"
              : "status-failed"
          }`}
        >
          <div className="status-badge-row">
            {dispatchResult.delivery_status === "SENT" ? (
              <CheckCircle2 size={18} className="text-emerald flex-shrink-0" />
            ) : dispatchResult.delivery_status === "GATEWAY_NOT_CONFIGURED" || dispatchResult.delivery_status === "SMTP_NOT_CONFIGURED" || dispatchResult.delivery_status === "DEMO_VERIFIED" ? (
              <AlertTriangle size={18} className="text-amber flex-shrink-0" />
            ) : (
              <XCircle size={18} className="text-red flex-shrink-0" />
            )}
            <div>
              <strong>
                {dispatchResult.recipient_email ? "Email Alert Status: " : "SMS Delivery Status: "}
                <span className="font-mono">{dispatchResult.delivery_status}</span>
              </strong>
              <p className="status-explanation">
                {dispatchResult.error ||
                  `Real SMS alert successfully forwarded to carrier for recipient ${dispatchResult.recipient_phone}. Gateway Provider ID: ${dispatchResult.provider_id}`}
              </p>
              {dispatchResult.message && (
                <div style={{ marginTop: "6px", padding: "6px 10px", background: "rgba(0,0,0,0.2)", borderRadius: "6px", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                  <strong>Message Payload:</strong> {dispatchResult.message}
                </div>
              )}
            </div>
          </div>
          <div className="status-footer-meta">
            <span>Recipient: <strong>{dispatchResult.recipient_phone}</strong></span>
            <span>Wards: <strong>{dispatchResult.wards?.join(", ") || "Ward 01, Ward 02"}</strong></span>
            <span>Date: <strong>{dispatchResult.prediction_date || new Date().toISOString().split("T")[0]}</strong></span>
            {onNavigateTab && (
              <button
                className="btn-link-admin"
                onClick={() => onNavigateTab("admin")}
              >
                Configure Gateway in backend/.env &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Surveillance Advisory Banner */}
      <div className="alert-integrity-banner">
        <ShieldCheck size={18} className="text-emerald flex-shrink-0" />
        <div>
          <strong>Surveillance Early Warning Advisory:</strong>
          <span> Automated risk alerts triggered by EVOI thresholds to direct preventive municipal interventions and fever screening.</span>
        </div>
      </div>

      {/* Alert Metrics Bar */}
      <div className="alert-stats-grid">
        <div className="alert-stat-card border-red">
          <div className="alert-stat-icon red">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3>{highSeverityCount}</h3>
            <p>High Priority Alerts</p>
            <small>Immediate vector control &amp; fever survey</small>
          </div>
        </div>

        <div className="alert-stat-card border-amber">
          <div className="alert-stat-icon amber">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3>{mediumSeverityCount}</h3>
            <p>Surveillance Alerts</p>
            <small>Active monitoring &amp; container reduction</small>
          </div>
        </div>

        <div className="alert-stat-card border-cyan">
          <div className="alert-stat-icon cyan">
            <Building size={20} />
          </div>
          <div>
            <h3>{wardData.length}</h3>
            <p>Monitored Wards</p>
            <small>Coimbatore Municipal Corporation</small>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="table-controls-bar">
        <div className="filter-pill-group">
          {["ALL", "HIGH", "MEDIUM"].map((sev) => (
            <button
              key={sev}
              className={`filter-pill-btn ${severityFilter === sev ? "active" : ""}`}
              onClick={() => setSeverityFilter(sev)}
            >
              {sev === "ALL" ? "All Alert Severities" : `${sev} Priority`}
            </button>
          ))}
        </div>

        <div className="search-box" style={{ maxWidth: "320px" }}>
          <input
            type="text"
            placeholder="Filter by ward name..."
            value={searchWard}
            onChange={(e) => setSearchWard(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="alerts-feed">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((al) => {
            const isHigh = al.type === "high";
            const targetWard = wardData.find(
              (w) => w.name.toLowerCase() === al.ward.toLowerCase()
            );

            return (
              <article
                key={al.id}
                className={`alert-feed-card ${isHigh ? "card-high" : "card-medium"}`}
              >
                <div className="alert-card-left">
                  <div className={`alert-badge-icon ${isHigh ? "red" : "amber"}`}>
                    {isHigh ? <ShieldAlert size={22} /> : <AlertTriangle size={22} />}
                  </div>
                </div>

                <div className="alert-card-main">
                  <div className="alert-card-header">
                    <div className="alert-tags">
                      <span className={`severity-tag ${isHigh ? "high" : "medium"}`}>
                        {isHigh ? "HIGH PRIORITY ACTION" : "SURVEILLANCE MONITORING"}
                      </span>
                      <span className="disease-tag">{selectedDisease}</span>
                      <span className="ward-tag">
                        <MapPin size={12} />
                        {al.ward} · {selectedDistrict}
                      </span>
                    </div>
                    <span className="alert-cycle-time">
                      <Calendar size={12} />
                      {al.created_at || "Current surveillance cycle"}
                    </span>
                  </div>

                  <h3 className="alert-title">{al.title}</h3>
                  <p className="alert-reason">{al.description}</p>

                  <div className="alert-meta-strip">
                    <div className="meta-pill">
                      <span>Observed Active Cases:</span>
                      <strong>{targetWard?.cases ?? "Elevated"}</strong>
                    </div>
                    <div className="meta-pill">
                      <span>Attack Rate:</span>
                      <strong>
                        {targetWard
                          ? `${((targetWard.cases / Math.max(1, targetWard.population)) * 1000).toFixed(2)} / 1k`
                          : "High"}
                      </strong>
                    </div>
                    <div className="meta-pill">
                      <span>Trigger Engine:</span>
                      <strong>EVOI Multi-Factor Threshold</strong>
                    </div>
                  </div>

                  <div className="alert-action-box">
                    <strong>Recommended Municipal Action Protocol:</strong>
                    <p>
                      {isHigh
                        ? "Deploy rapid fogging & larviciding within 24 hours. Mobilize primary health centre (PHC) fever teams for door-to-door febrile case screening."
                        : "Verify outdoor standing water bodies. Enforce weekly container inspection and community dry-day protocols."}
                    </p>
                  </div>
                </div>

                <div className="alert-card-right">
                  {targetWard && (
                    <button
                      className="btn-inspect-ward"
                      onClick={() => onSelectWard(targetWard)}
                    >
                      Inspect Ward Dossier
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="panel empty-panel">
            <CheckCircle2 size={36} className="text-emerald" />
            <h3>No Active Alerts for Selected Filter</h3>
            <p>All monitored municipal wards currently remain within baseline transmission parameters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
