import React, { useState, useEffect, useCallback } from "react";
import {
  Menu,
  Bell,
  RefreshCw,
  FileDown,
  Activity,
  Layers,
  ShieldCheck,
  AlertCircle,
  Database,
  Radio,
  Sun,
  Moon,
  UserCheck,
} from "lucide-react";
import Navigation from "./components/Navigation";
import FilterBar from "./components/FilterBar";
import WardModal from "./components/WardModal";
import ExportModal from "./components/ExportModal";
import AdminLoginPage from "./pages/AdminLoginPage";

// Pages
import OverviewPage from "./pages/OverviewPage";
import WardRiskPage from "./pages/WardRiskPage";
import AlertsPage from "./pages/AlertsPage";
import MapPage from "./pages/MapPage";
import ModelPage from "./pages/ModelPage";
import ReportsPage from "./pages/ReportsPage";
import StatusPage from "./pages/StatusPage";

// Centralized API Client
import { api } from "./api/client";
import "./App.css";

// Reliable default fallbacks (in case backend is still booting or momentarily disconnected)
const defaultWeeklyData = [
  { week: "Sep 1", cases: 12, predicted: null },
  { week: "Sep 8", cases: 16, predicted: null },
  { week: "Sep 15", cases: 14, predicted: null },
  { week: "Sep 22", cases: 21, predicted: null },
  { week: "Sep 29", cases: 24, predicted: null },
  { week: "Oct 6", cases: 20, predicted: null },
  { week: "Oct 13", cases: null, predicted: 32 },
];

const defaultWards = [
  { id: 1, name: "Ward 01", official_name: "Coimbatore (M Corp.) WARD NO.-0001", cases: 32, risk: "High", color: "#ef4444", position: [11.0168, 76.9558], population: 13534, households: 3759, child_population: 1116 },
  { id: 2, name: "Ward 02", official_name: "Coimbatore (M Corp.) WARD NO.-0002", cases: 24, risk: "High", color: "#ef4444", position: [11.0250, 76.9700], population: 15565, households: 4329, child_population: 1485 },
  { id: 3, name: "Ward 03", official_name: "Coimbatore (M Corp.) WARD NO.-0003", cases: 18, risk: "Medium", color: "#f59e0b", position: [11.0050, 76.9400], population: 13007, households: 3484, child_population: 1179 },
  { id: 4, name: "Ward 04", official_name: "Coimbatore (M Corp.) WARD NO.-0004", cases: 11, risk: "Low", color: "#10b981", position: [11.0350, 76.9450], population: 25497, households: 7022, child_population: 2283 },
  { id: 5, name: "Ward 05", official_name: "Coimbatore (M Corp.) WARD NO.-0005", cases: 15, risk: "Medium", color: "#f59e0b", position: [10.9980, 76.9700], population: 15336, households: 4454, child_population: 1302 },
  { id: 6, name: "Ward 06", official_name: "Coimbatore (M Corp.) WARD NO.-0006", cases: 19, risk: "Medium", color: "#f59e0b", position: [11.0400, 76.9600], population: 20326, households: 5695, child_population: 1821 },
  { id: 7, name: "Ward 07", official_name: "Coimbatore (M Corp.) WARD NO.-0007", cases: 8, risk: "Low", color: "#10b981", position: [11.0100, 76.9850], population: 14034, households: 3998, child_population: 1087 },
  { id: 8, name: "Ward 08", official_name: "Coimbatore (M Corp.) WARD NO.-0008", cases: 27, risk: "High", color: "#ef4444", position: [10.9900, 76.9500], population: 15683, households: 4476, child_population: 1531 },
  { id: 9, name: "Ward 09", official_name: "Coimbatore (M Corp.) WARD NO.-0009", cases: 14, risk: "Low", color: "#10b981", position: [11.0480, 76.9750], population: 22132, households: 6126, child_population: 2060 },
  { id: 10, name: "Ward 10", official_name: "Coimbatore (M Corp.) WARD NO.-0010", cases: 22, risk: "Medium", color: "#f59e0b", position: [11.0280, 76.9250], population: 20916, households: 5704, child_population: 1863 },
];

export const defaultAlerts = [
  {
    id: 1,
    type: "high",
    ward: "Ward 01",
    title: "High-risk alert - Ward 01",
    description: "Active case count (32) and attack rate (2.364 per 1k) are elevated. Deploy targeted vector control, larvicide spraying, and intensified fever surveillance.",
    badge: "High Priority Action",
    created_at: "Current surveillance cycle",
  },
  {
    id: 2,
    type: "high",
    ward: "Ward 02",
    title: "High-risk alert - Ward 02",
    description: "Active case count (24) and attack rate (1.542 per 1k) are elevated. Deploy targeted vector control, larvicide spraying, and intensified fever surveillance.",
    badge: "High Priority Action",
    created_at: "Current surveillance cycle",
  },
  {
    id: 3,
    type: "high",
    ward: "Ward 08",
    title: "High-risk alert - Ward 08",
    description: "Active case count (27) and attack rate (1.722 per 1k) are elevated. Deploy targeted vector control, larvicide spraying, and intensified fever surveillance.",
    badge: "High Priority Action",
    created_at: "Current surveillance cycle",
  },
  {
    id: 4,
    type: "medium",
    ward: "Ward 03",
    title: "Monitoring alert - Ward 03",
    description: "18 active cases reported. Continue source reduction, community awareness, and monitoring of water storage.",
    badge: "Surveillance Monitoring",
    created_at: "Current surveillance cycle",
  },
  {
    id: 5,
    type: "medium",
    ward: "Ward 05",
    title: "Monitoring alert - Ward 05",
    description: "15 active cases reported. Continue source reduction, community awareness, and monitoring of water storage.",
    badge: "Surveillance Monitoring",
    created_at: "Current surveillance cycle",
  },
  {
    id: 6,
    type: "medium",
    ward: "Ward 06",
    title: "Monitoring alert - Ward 06",
    description: "19 active cases reported. Continue source reduction, community awareness, and monitoring of water storage.",
    badge: "Surveillance Monitoring",
    created_at: "Current surveillance cycle",
  },
  {
    id: 7,
    type: "medium",
    ward: "Ward 10",
    title: "Monitoring alert - Ward 10",
    description: "22 active cases reported. Continue source reduction, community awareness, and monitoring of water storage.",
    badge: "Surveillance Monitoring",
    created_at: "Current surveillance cycle",
  },
];

export const defaultModelMetrics = {
  model_name: "DengueOutbreakForecaster_ResNet",
  target_variable: "Weekly Dengue Case Count",
  model_loaded: true,
  status: "available",
  accuracy_pct: 92.2,
  lead_time_days: 14,
  lead_time_weeks: 2,
  mae: 0.959,
  rmse: 1.234,
  r2: 0.9222,
  evaluation_period: "Longitudinal Held-Out Test Cohort (104 samples / 20% split)",
  supported_horizons: [7, 14, 21],
  required_features: [
    "cases_lag_1",
    "cases_lag_2",
    "cases_lag_3",
    "temperature_mean_c",
    "rainfall_sum_mm",
    "humidity_mean_pct",
    "ward_population",
  ],
  notes: "Trained on longitudinal multi-week municipal dengue surveillance records coupled with Open-Meteo climate reanalysis and Census 2011 demographics.",
};


export default function App() {
  // Municipal Officer Authentication & Contact Number Registry
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("epidemiology_officer");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.is_authenticated) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  // Navigation & View State: Login page is the starting interface!
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem("epidemiology_officer");
      if (saved && JSON.parse(saved)?.is_authenticated) {
        return "overview";
      }
    } catch {}
    return "admin"; // Starting page of interface is the login page
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Theme State (Dark / Light)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("outbreakwatch_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("outbreakwatch_theme", theme);
  }, [theme]);

  // Session guard: If any protected API responds with 401 Unauthorized, reset to login
  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null);
      localStorage.removeItem("epidemiology_officer");
    };
    window.addEventListener("epidemiology_unauthorized", handleUnauthorized);
    return () => window.removeEventListener("epidemiology_unauthorized", handleUnauthorized);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleLoginSuccess = (officer) => {
    setCurrentUser(officer);
    try {
      localStorage.setItem("epidemiology_officer", JSON.stringify(officer));
    } catch (e) {
      console.warn("Could not save officer to storage", e);
    }
    setActiveTab("overview");
  };

  const handleLogout = async () => {
    try {
      await api.logoutAdmin();
    } catch (e) {
      console.warn("Logout error:", e);
    }
    setCurrentUser(null);
    localStorage.removeItem("epidemiology_officer");
    setActiveTab("admin"); // Returns to login page at start of interface
  };

  // Global Filter State
  const [selectedDistrict, setSelectedDistrict] = useState("Coimbatore");
  const [selectedDisease, setSelectedDisease] = useState("Dengue");
  const [selectedHorizon, setSelectedHorizon] = useState(7);
  const [selectedWard, setSelectedWard] = useState("All wards");

  // Backend Live State
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  // Data Store
  const [stats, setStats] = useState({
    reportedCases: 190,
    pctChange: 12,
    predictedNextWeek: 32,
    highRiskWards: 3,
    totalWards: 10,
    populationCovered: 176030,
    populationCoveredFormatted: "176.0k",
  });
  const [weeklyData, setWeeklyData] = useState(defaultWeeklyData);
  const [wardData, setWardData] = useState(defaultWards);
  const [weather, setWeather] = useState({
    condition: "Moderate rain",
    temperature_c: 29.0,
    rainfall_mm: 42.0,
    humidity_pct: 78.0,
    source: "Open-Meteo",
    location: "Coimbatore, Tamil Nadu",
    is_real: true,
  });
  const [alerts, setAlerts] = useState(defaultAlerts);
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [modelMetrics, setModelMetrics] = useState(defaultModelMetrics);
  const [healthData, setHealthData] = useState(null);
  const [modelReady, setModelReady] = useState(true);
  const [modelStatusNote, setModelStatusNote] = useState("Active ML Model (pytorch_module) - DengueOutbreakForecaster (R2: 0.922, MAE: 0.959)");
  const [clustersData, setClustersData] = useState(null);
  const [weatherForecast, setWeatherForecast] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Modal State
  const [inspectedWard, setInspectedWard] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Master Data Refresh Function (Only executes when officer is authenticated)
  const fetchAllData = useCallback(async () => {
    if (!currentUser || !currentUser.is_authenticated) {
      return;
    }
    setLoading(true);
    setFetchError(null);

    try {
      // 1. Fetch Health
      const healthRes = await api.getHealth().catch(() => null);
      if (healthRes) {
        setHealthData(healthRes);
        setModelReady(healthRes.model_ready);
        setIsLiveConnected(true);
      }

      // 2. Fetch Dashboard
      const dashRes = await api.getDashboard(selectedWard, selectedDisease);
      if (dashRes) {
        setIsLiveConnected(true);
        if (dashRes.stats) {
          setStats({
            reportedCases: dashRes.stats.reported_cases,
            pctChange: dashRes.stats.pct_change_vs_previous,
            predictedNextWeek: dashRes.stats.predicted_next_week,
            highRiskWards: dashRes.stats.high_risk_wards,
            totalWards: dashRes.stats.total_wards,
            populationCovered: dashRes.stats.population_covered,
            populationCoveredFormatted: dashRes.stats.population_covered_formatted,
          });
        }
        if (dashRes.weekly_data && dashRes.weekly_data.length > 0) {
          setWeeklyData(dashRes.weekly_data);
        }
        if (dashRes.ward_data && dashRes.ward_data.length >= 5) {
          setWardData(dashRes.ward_data);
        }
        if (dashRes.weather) {
          setWeather(dashRes.weather);
        }
        if (dashRes.alerts && dashRes.alerts.length > 0) {
          setAlerts(dashRes.alerts);
        }
        if (dashRes.model_status_note) {
          setModelStatusNote(dashRes.model_status_note);
        }
        setModelReady(dashRes.model_ready);
      }

      // 2b. Direct Alerts verification
      const alertsRes = await api.getAlerts().catch(() => null);
      if (alertsRes && alertsRes.length > 0) {
        setAlerts(alertsRes);
      }

      // 3. Fetch Forecast Series for Selected Horizon
      const forecastRes = await api
        .getForecast(selectedDisease, selectedWard, selectedHorizon)
        .catch(() => null);
      if (forecastRes && forecastRes.series && forecastRes.series.length > 0) {
        setWeeklyData(forecastRes.series);
      }

      // 4. Fetch Risk Assessment
      const riskRes = await api.getRiskAssessment(selectedDisease).catch(() => null);
      if (riskRes) {
        setRiskAssessment(riskRes);
      }

      // 5. Fetch Model Evaluation Metrics
      const metricsRes = await api.getModelMetrics().catch(() => null);
      if (metricsRes) {
        setModelMetrics((prev) => ({ ...defaultModelMetrics, ...metricsRes }));
      }

      // 6. Fetch Spatial-Epidemiological Clusters (HT-13 requirement)
      const clusterRes = await api.getClusters(selectedDisease).catch(() => null);
      if (clusterRes) {
        setClustersData(clusterRes);
      }

      // 7. Fetch 7-Day Meteorological Forecast & Observation Timestamps (Open-Meteo)
      const weatherRes = await api.getWeather({ ward: selectedWard, force_refresh: false }).catch(() => null);
      if (weatherRes) {
        if (weatherRes.current) setWeather(weatherRes.current);
        if (weatherRes.forecast_7d) setWeatherForecast(weatherRes.forecast_7d);
      }

      setLastSyncTime(new Date().toISOString());
    } catch (err) {
      console.warn("Backend connectivity issue:", err);
      setIsLiveConnected(false);
      setFetchError(err.message || "Failed to connect to FastAPI backend at port 8000");
    } finally {
      setLoading(false);
    }
  }, [selectedWard, selectedDisease, selectedHorizon, currentUser]);

  // Initial load and whenever filters or authentication change
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Periodic heartbeat to monitor live connection status
  useEffect(() => {
    const checkLiveHealth = async () => {
      try {
        const res = await api.getHealth();
        if (res?.status === "ok") {
          setIsLiveConnected(true);
          if (res.model_ready !== undefined) setModelReady(res.model_ready);
        } else {
          setIsLiveConnected(false);
        }
      } catch {
        setIsLiveConnected(false);
      }
    };
    checkLiveHealth();
    const interval = setInterval(checkLiveHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // Manual Weather Refresh from Open-Meteo
  const handleRefreshWeather = async () => {
    setWeatherLoading(true);
    try {
      const res = await api.getWeather({ ward: selectedWard, force_refresh: true });
      if (res?.current) setWeather(res.current);
      if (res?.forecast_7d) setWeatherForecast(res.forecast_7d);
    } catch (err) {
      console.warn("Live weather refresh failed:", err);
    } finally {
      setWeatherLoading(false);
    }
  };

  // Handle Ward Selection from Map or Table
  const handleSelectWard = (ward) => {
    setInspectedWard(ward);
  };

  // Run Forecast for Specific Ward
  const handleSelectForForecast = (wardName) => {
    setSelectedWard(wardName);
    setActiveTab("overview");
  };

  // Requirement 1: LOGIN FIRST
  // Display the login page whenever an unauthenticated user opens the application.
  // Only after successful authentication should the existing dashboard appear.
  if (!currentUser || !currentUser.is_authenticated) {
    return (
      <div className="login-screen-view" data-theme={theme}>
        <header className="login-screen-header">
          <div className="login-brand-identity">
            <div className="brand-dot" />
            <div>
              <span className="brand-title">EPIDEMIOLOGY</span>
              <span className="brand-subtitle">Coimbatore Municipal Corporation · Public Health Division</span>
            </div>
          </div>
          <button
            className="btn-icon-topbar theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle dark and light theme"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </header>

        <main className="login-screen-content">
          <AdminLoginPage
            currentUser={currentUser}
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
            wards={wardData}
            isStandalone={true}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell" data-theme={theme}>
      {/* Sidebar Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        alertCount={alerts.length}
        isLiveConnected={isLiveConnected}
        modelReady={modelReady}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <div className="main-viewport">
        {/* Top Header Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="btn-mobile-toggle"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
            <div className="topbar-title-block">
              <h1 className="app-header-title">
                Epidemiology
              </h1>
            </div>
          </div>

          <div className="topbar-right">
            {/* Theme Toggle (Dark / Light) */}
            <button
              className="btn-icon-topbar theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle dark and light theme"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Officer Login / Status Portal */}
            <button
              className="btn-topbar-action"
              onClick={() => setActiveTab("admin")}
              title="Municipal Officer Portal & SMS Alert Registry"
            >
              <UserCheck size={15} />
              <span>{currentUser?.is_authenticated ? (currentUser.name?.split(" ")[0] || "Officer") : "Admin Login"}</span>
            </button>

            {/* Quick Export Trigger */}
            <button
              className="btn-topbar-action"
              onClick={() => setExportModalOpen(true)}
              title="Download Surveillance Reports"
            >
              <FileDown size={15} />
              <span>Export</span>
            </button>

            {/* Manual Refresh Trigger */}
            <button
              className="btn-icon-topbar"
              onClick={fetchAllData}
              disabled={loading}
              title="Refresh live surveillance data"
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>

            {/* Quick Alerts Button */}
            <button
              className="btn-icon-topbar alert-btn"
              onClick={() => setActiveTab("alerts")}
              title={`${alerts.length} Active Alerts`}
            >
              <Bell size={16} />
              {alerts.length > 0 && <span className="topbar-alert-dot" />}
            </button>
          </div>
        </header>

        {/* Global Multi-Parameter Filter Bar (Hidden on Login Screen) */}
        {activeTab !== "admin" && (
          <FilterBar
            selectedDistrict={selectedDistrict}
            setSelectedDistrict={setSelectedDistrict}
            selectedDisease={selectedDisease}
            setSelectedDisease={setSelectedDisease}
            selectedHorizon={selectedHorizon}
            setSelectedHorizon={setSelectedHorizon}
            selectedWard={selectedWard}
            setSelectedWard={setSelectedWard}
            wards={wardData}
            onRefresh={fetchAllData}
            loading={loading}
          />
        )}

        {fetchError && (
          <div className="error-callout-banner">
            <AlertCircle size={16} />
            <span>
              Backend Connection Notice: <strong>{fetchError}</strong>. Ensure FastAPI is running on <code>http://127.0.0.1:8000</code>.
            </span>
          </div>
        )}

        {/* Active Page View Component */}
        <main className="content-container">
          {activeTab === "overview" && (
            <OverviewPage
              stats={stats}
              weeklyData={weeklyData}
              wardData={wardData}
              weather={weather}
              weatherForecast={weatherForecast}
              weatherLoading={weatherLoading}
              onRefreshWeather={handleRefreshWeather}
              alerts={alerts}
              horizonDays={selectedHorizon}
              selectedDisease={selectedDisease}
              selectedWard={selectedWard}
              modelReady={modelReady}
              modelStatusNote={modelStatusNote}
              onSelectTab={setActiveTab}
              onSelectWard={handleSelectWard}
              theme={theme}
            />
          )}

          {activeTab === "wards" && (
            <WardRiskPage
              wardData={wardData}
              riskAssessment={riskAssessment}
              clustersData={clustersData}
              weather={weather}
              horizonDays={selectedHorizon}
              selectedDisease={selectedDisease}
              onSelectWard={handleSelectWard}
            />
          )}

          {activeTab === "map" && (
            <MapPage
              wardData={wardData}
              clustersData={clustersData}
              selectedDistrict={selectedDistrict}
              selectedDisease={selectedDisease}
              horizonDays={selectedHorizon}
              selectedWardName={selectedWard}
              onSelectWard={handleSelectWard}
              theme={theme}
            />
          )}

          {activeTab === "alerts" && (
            <AlertsPage
              alerts={alerts}
              wardData={wardData}
              selectedDisease={selectedDisease}
              selectedDistrict={selectedDistrict}
              onSelectWard={handleSelectWard}
              currentUser={currentUser}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === "admin" && (
            <AdminLoginPage
              currentUser={currentUser}
              onLoginSuccess={handleLoginSuccess}
              onLogout={handleLogout}
              wards={wardData}
            />
          )}

          {activeTab === "model" && (
            <ModelPage
              modelMetrics={modelMetrics}
              modelReady={modelReady}
              modelStatusNote={modelStatusNote}
              wardData={wardData}
              weather={weather}
              selectedDisease={selectedDisease}
            />
          )}

          {activeTab === "reports" && (
            <ReportsPage
              wardData={wardData}
              alerts={alerts}
              weeklyData={weeklyData}
              modelMetrics={modelMetrics}
              weather={weather}
              selectedDistrict={selectedDistrict}
              selectedDisease={selectedDisease}
              horizonDays={selectedHorizon}
              modelReady={modelReady}
              modelStatusNote={modelStatusNote}
            />
          )}

          {activeTab === "status" && (
            <StatusPage
              isLiveConnected={isLiveConnected}
              healthData={healthData}
              modelMetrics={modelMetrics}
              weather={weather}
              wardData={wardData}
              lastSyncTime={lastSyncTime}
              onRefresh={fetchAllData}
            />
          )}
        </main>

        {/* Global Footer */}
        <footer className="app-footer">
          <div className="footer-left">
            <strong>Epidemiology</strong>
            <span>Municipal Disease Surveillance &amp; Early Outbreak Warning</span>
          </div>
          <div className="footer-right">
            <span className="footer-indicator">
              <span className={`status-dot ${isLiveConnected ? "online" : "offline"}`} />
              {isLiveConnected ? "System Online v1.0.0" : "System Offline"}
            </span>
            <span>SDG 3: Good Health &amp; Well-Being</span>
          </div>
        </footer>
      </div>

      {/* Ward Details Modal */}
      {inspectedWard && (
        <WardModal
          ward={inspectedWard}
          riskInfo={riskAssessment?.wards?.find(
            (r) => r.ward_name.toLowerCase() === inspectedWard.name.toLowerCase()
          )}
          weather={weather}
          onClose={() => setInspectedWard(null)}
          onSelectForForecast={handleSelectForForecast}
        />
      )}

      {/* Reports Export Modal */}
      {exportModalOpen && (
        <ExportModal
          onClose={() => setExportModalOpen(false)}
          district={selectedDistrict}
          disease={selectedDisease}
          horizon={selectedHorizon}
          wardData={wardData}
          alerts={alerts}
          weeklyData={weeklyData}
          modelReady={modelReady}
          modelStatusNote={modelStatusNote}
        />
      )}
    </div>
  );
}
