import React from "react";
import {
  LayoutDashboard,
  MapPin,
  TrendingUp,
  Bell,
  Cpu,
  FileDown,
  Server,
  Activity,
  X,
  Radio,
  UserCheck,
} from "lucide-react";

export default function Navigation({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
  alertCount = 0,
  isLiveConnected = false,
  modelReady = false,
  currentUser = null,
}) {
  const navItems = [
    { id: "overview", label: "Surveillance Overview", icon: LayoutDashboard },
    { id: "wards", label: "Ward Risk Analysis", icon: TrendingUp },
    { id: "map", label: "Coimbatore Heat Map", icon: MapPin },
    { id: "alerts", label: "Early Warning & Alerts", icon: Bell, count: alertCount },
    { id: "model", label: "Model & Lead Time", icon: Cpu },
    { id: "reports", label: "Reports & Data Export", icon: FileDown },
    { id: "admin", label: currentUser ? "Officer Portal (Active)" : "Admin Login", icon: UserCheck },
    { id: "status", label: "System Diagnostics", icon: Server },
  ];

  return (
    <>
      {mobileOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-badge">
              <Activity size={22} className="pulse-icon" />
            </div>
            <div className="brand-text">
              <h2>Epidemi<span>ology</span></h2>
              <p>DISEASE SURVEILLANCE &amp; PREDICTION</p>
            </div>
          </div>
          <button
            className="mobile-close-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-section-title">SURVEILLANCE WORKSPACE</div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-button ${isActive ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
              >
                <Icon size={18} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
                {item.count > 0 && (
                  <span className="nav-badge-alert">{item.count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {currentUser && (
          <div className="sidebar-officer-status">
            <div className="officer-badge-indicator" />
            <div className="officer-badge-info">
              <span className="officer-name">{currentUser.name || "Municipal Officer"}</span>
              <span className="officer-phone">{currentUser.contact_number}</span>
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          <div className="system-pill">
            <Radio
              size={14}
              className={isLiveConnected ? "conn-active" : "conn-offline"}
            />
            <div className="pill-text">
              <span className="pill-title">
                {isLiveConnected ? "System Online" : "Connecting..."}
              </span>
              <span className="pill-sub">
                {modelReady ? "ML Active" : "Baseline Active"}
              </span>
            </div>
            <span
              className={`pill-indicator ${
                isLiveConnected ? "indicator-green" : "indicator-yellow"
              }`}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
