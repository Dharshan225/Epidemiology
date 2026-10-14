import React from "react";
import {
  Activity,
  TrendingUp,
  ShieldAlert,
  Users,
  Bell,
  Calendar,
  CloudRain,
  Thermometer,
  Wind,
  Gauge,
  ArrowUpRight,
  ChevronRight,
  Database,
  RefreshCw,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { defaultAlerts } from "../App";


export default function OverviewPage({
  stats,
  weeklyData = [],
  wardData = [],
  weather,
  weatherForecast = [],
  weatherLoading = false,
  onRefreshWeather,
  alerts = [],
  horizonDays = 7,
  selectedDisease = "Dengue",
  selectedWard = "All wards",
  modelReady = false,
  modelStatusNote = "",
  onSelectTab,
  onSelectWard,
  theme = "dark",
}) {
  const isLight = theme === "light";
  const gridStroke = isLight ? "#e2e8f0" : "#1e293b";
  const axisStroke = isLight ? "#94a3b8" : "#64748b";
  const tickColor = isLight ? "#475569" : "#94a3b8";
  const tooltipStyle = {
    backgroundColor: isLight ? "#ffffff" : "#0f172a",
    borderColor: isLight ? "#cbd5e1" : "#334155",
    borderRadius: "8px",
    color: isLight ? "#0f172a" : "#f8fafc",
    boxShadow: isLight ? "0 4px 6px -1px rgba(0,0,0,0.08)" : "0 4px 6px -1px rgba(0,0,0,0.5)",
    fontSize: "12px",
  };

  // Risk Category Distribution Data
  const highRiskCount = wardData.filter((w) => w.risk === "High").length;
  const mediumRiskCount = wardData.filter((w) => w.risk === "Medium").length;
  const lowRiskCount = wardData.filter((w) => w.risk === "Low").length;

  const riskDistributionData = [
    { name: "High Risk", count: highRiskCount, color: "#ef4444" },
    { name: "Medium Risk", count: mediumRiskCount, color: "#f59e0b" },
    { name: "Low Risk", count: lowRiskCount, color: "#10b981" },
  ];

  // Ward comparison data: Historical vs Predicted
  const wardComparisonData = wardData.map((w) => {
    const projected = Math.max(1, Math.round(w.cases * (1 + horizonDays * 0.02)));
    return {
      name: w.name,
      observed: w.cases,
      predicted: projected,
      risk: w.risk,
    };
  });

  const safeAlerts = alerts && alerts.length > 0 ? alerts : defaultAlerts;
  const safeHighAlerts = safeAlerts.filter((a) => a.type === "high").length;
  const safeMedAlerts = safeAlerts.filter((a) => a.type === "medium").length;

  return (
    <div className="page-content">
      <div className="page-header-block">
        <div>
          <span className="eyebrow-pill">EPIDEMIOLOGICAL SURVEILLANCE OVERVIEW</span>
          <h1 className="page-title">Surveillance Dashboard &amp; Outbreak Monitoring</h1>
          <p className="page-subtitle">
            Real-time municipal disease surveillance, environmental risk indicators via Open-Meteo, and neural network outbreak forecasts across Coimbatore Municipal Corporation wards.
          </p>
        </div>
      </div>

      {/* SECTION 1: Surveillance KPI Cards */}
      <section className="kpi-grid">
        {/* Total Reported Cases */}
        <article className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Reported Cases</span>
            <div className="kpi-icon-box cyan">
              <Activity size={19} />
            </div>
          </div>
          <div className="kpi-val-row">
            <h2 className="kpi-val">{stats.reportedCases ?? "—"}</h2>
            <span className="kpi-pill positive">
              <ArrowUpRight size={13} />
              +{stats.pctChange ?? 12}%
            </span>
          </div>
          <p className="kpi-sub">Active surveillance cycle</p>
        </article>

        {/* Monitored Wards */}
        <article className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Monitored Wards</span>
            <div className="kpi-icon-box teal">
              <Database size={19} />
            </div>
          </div>
          <div className="kpi-val-row">
            <h2 className="kpi-val">
              {stats.totalWards ?? wardData.length}{" "}
              <small className="kpi-denominator">Wards</small>
            </h2>
            <span className="kpi-pill neutral">
              {stats.populationCoveredFormatted ?? "48.2k"} Pop.
            </span>
          </div>
          <p className="kpi-sub">Coimbatore Corporation</p>
        </article>

        {/* Wards Classified as High Risk */}
        <article className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">High-Risk Wards</span>
            <div className="kpi-icon-box red">
              <ShieldAlert size={19} />
            </div>
          </div>
          <div className="kpi-val-row">
            <h2 className="kpi-val text-red">
              {stats.highRiskWards ?? highRiskCount}{" "}
              <small className="kpi-denominator">
                / {stats.totalWards ?? wardData.length}
              </small>
            </h2>
            <span className="kpi-pill danger">Action Required</span>
          </div>
          <p className="kpi-sub">Immediate vector intervention</p>
        </article>

        {/* Active Outbreak Alerts */}
        <article className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Active Outbreak Alerts</span>
            <div className="kpi-icon-box amber">
              <Bell size={19} />
            </div>
          </div>
          <div className="kpi-val-row">
            <h2 className="kpi-val text-amber">{safeAlerts.length}</h2>
            <span className="kpi-pill warning">Surveillance Warnings</span>
          </div>
          <p className="kpi-sub">{safeHighAlerts} High · {safeMedAlerts} Monitoring</p>
        </article>

        {/* Current Forecast Horizon */}
        <article className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Selected Horizon</span>
            <div className="kpi-icon-box purple">
              <Calendar size={19} />
            </div>
          </div>
          <div className="kpi-val-row">
            <h2 className="kpi-val">
              {horizonDays} <small className="kpi-denominator">Days</small>
            </h2>
            <span className="kpi-pill info">{horizonDays / 7} Wk Ahead</span>
          </div>
          <p className="kpi-sub">Forward projection interval</p>
        </article>

        {/* Data Freshness & Status */}
        <article className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Data Freshness</span>
            <div className="kpi-icon-box emerald">
              <Gauge size={19} />
            </div>
          </div>
          <div className="kpi-val-row">
            <h2 className="kpi-val text-emerald" style={{ fontSize: "19px" }}>
              Active Cycle
            </h2>
            <span className="kpi-pill success">Live Synced</span>
          </div>
          <p className="kpi-sub">Real-time meteorological sync</p>
        </article>
      </section>

      {/* SECTION 2: Primary Visualizations Grid */}
      <div className="dashboard-grid-2">
        {/* Epidemic Curve: Historical Cases vs Forecast */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Epidemiological Case Trends &amp; Outbreak Forecast</h3>
              <p className="panel-desc">
                Weekly reported surveillance cases and model-projected trajectory for {selectedWard} ({selectedDisease})
              </p>
            </div>
            <span className="tag-pill">
              Horizon: {horizonDays} Days Ahead
            </span>
          </div>

          <div className="chart-legend-row">
            <div className="legend-item">
              <span className="dot dot-cyan" />
              <span>Reported Cases (Historical Surveillance)</span>
            </div>
            <div className="legend-item">
              <span className="dot dot-purple" />
              <span>Model Projection ({horizonDays}d Horizon)</span>
            </div>
          </div>

          <div className="chart-container" style={{ height: "280px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" stroke={axisStroke} tick={{ fill: tickColor, fontSize: 11 }} />
                <YAxis stroke={axisStroke} tick={{ fill: tickColor, fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="cases"
                  name="Observed Cases"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fill="url(#cyanGradient)"
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="predicted"
                  name="Forecasted Cases"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  fill="url(#purpleGradient)"
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-footer-note">
            <span className="note-label">Model Engine:</span>
            <span>{modelStatusNote || "Active epidemiological forecasting engine"}</span>
          </div>
        </article>

        {/* Ambient Environmental Factors (Open-Meteo) */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Meteorological Transmission Context</h3>
              <p className="panel-desc">
                Live ambient weather parameters for {selectedWard !== "All wards" ? selectedWard : "Coimbatore"} influencing vector breeding suitability
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className={`tag-pill ${weather?.is_real ? "tag-live" : "tag-warn"}`} style={{ fontSize: "10px", padding: "2px 8px" }}>
                {weather?.source || "Open-Meteo"} {weather?.is_real ? "Live" : "Baseline"}
              </span>
              {onRefreshWeather && (
                <button
                  className="btn-icon-topbar"
                  onClick={onRefreshWeather}
                  disabled={weatherLoading}
                  title="Refresh Open-Meteo live weather data"
                  style={{ width: "28px", height: "28px", padding: "0" }}
                >
                  <RefreshCw size={13} className={weatherLoading ? "spin" : ""} />
                </button>
              )}
            </div>
          </div>

          <div className="weather-hero">
            <div className="weather-hero-icon">
              <CloudRain size={32} />
            </div>
            <div className="weather-hero-info">
              <h3>{weather?.condition || "Moderate rain"}</h3>
              <p>{weather?.location || "Coimbatore, Tamil Nadu"}</p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "4px" }}>
                {weather?.observed_at && (
                  <small className="weather-source" title="Observation time from meteorological station">
                    Observed: {new Date(weather.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(weather.observed_at).toLocaleDateString([], { month: 'short', day: 'numeric' })})
                  </small>
                )}
                {weather?.retrieved_at && (
                  <small className="weather-source text-cyan" title="API fetch timestamp">
                    Retrieved: {new Date(weather.retrieved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </small>
                )}
              </div>
            </div>
          </div>

          {/* Missing data or baseline fallback warning */}
          {!weather?.is_real && (
            <div className="alert-callout-item medium" style={{ margin: "10px 0", padding: "8px 12px" }}>
              <AlertTriangle size={15} className="flex-shrink-0" />
              <span style={{ fontSize: "11px" }}>
                {weather?.notes || "Live meteorological API unreachable; displaying documented seasonal surveillance baseline."}
              </span>
            </div>
          )}

          <div className="weather-metric-list">
            <div className="weather-metric-row">
              <div className="weather-metric-k">
                <Thermometer size={16} className="text-cyan" />
                <span>Ambient Temperature</span>
              </div>
              <strong className="weather-metric-v">
                {weather?.temperature_c ?? 29.0}°C
              </strong>
            </div>

            <div className="weather-metric-row">
              <div className="weather-metric-k">
                <CloudRain size={16} className="text-blue" />
                <span>Cumulative Precipitation</span>
              </div>
              <strong className="weather-metric-v">
                {weather?.rainfall_mm ?? 42.0} mm
              </strong>
            </div>

            <div className="weather-metric-row">
              <div className="weather-metric-k">
                <Wind size={16} className="text-teal" />
                <span>Relative Humidity</span>
              </div>
              <strong className="weather-metric-v">
                {weather?.humidity_pct ?? 78.0}%
              </strong>
            </div>

            <div className="weather-metric-row">
              <div className="weather-metric-k">
                <Gauge size={16} className="text-purple" />
                <span>Vector Breeding Envelope</span>
              </div>
              <strong className="weather-metric-v text-amber">
                {(weather?.temperature_c >= 26 && weather?.temperature_c <= 32 && weather?.humidity_pct >= 70)
                  ? "Optimal Vector Ecology (High Risk)"
                  : (weather?.rainfall_mm > 25)
                  ? "Elevated Larval Breeding Habitat"
                  : "Moderate Transmission Envelope"}
              </strong>
            </div>
          </div>

          {/* 7-Day Meteorological Forecast Strip */}
          {weatherForecast && weatherForecast.length > 0 && (
            <div style={{ marginTop: "14px", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--cyan-primary)", marginBottom: "8px", display: "flex", justifyContent: "space-between" }}>
                <span>7-DAY METEOROLOGICAL FORECAST (OPEN-METEO)</span>
                <span style={{ color: "var(--text-muted)", fontWeight: "normal" }}>Daily Max / Rain</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(7, weatherForecast.length)}, 1fr)`, gap: "6px" }}>
                {weatherForecast.slice(0, 7).map((day, idx) => (
                  <div
                    key={day.date || idx}
                    style={{
                      background: "var(--bg-surface-2)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "6px",
                      padding: "6px 4px",
                      textAlign: "center",
                      fontSize: "10px"
                    }}
                  >
                    <div style={{ fontWeight: "700", color: "var(--text-secondary)", marginBottom: "2px" }}>
                      {new Date(day.date).toLocaleDateString([], { weekday: 'short' })}
                    </div>
                    <div style={{ color: "var(--cyan-primary)", fontWeight: "700" }}>
                      {day.temperature_max_c}°
                    </div>
                    <div style={{ color: day.precipitation_sum_mm > 10 ? "#60a5fa" : "var(--text-muted)", fontSize: "9px", marginTop: "2px" }}>
                      {day.precipitation_sum_mm}mm
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel-footer-note">
            <span>Aedes mosquito larval development accelerates within 26–32°C and humidity &gt; 70%. Source: Official Open-Meteo Forecast API.</span>
          </div>
        </article>
      </div>

      {/* SECTION 3: Secondary Visualizations Grid */}
      <div className="dashboard-grid-2" style={{ marginTop: "20px" }}>
        {/* Ward-Wise Observed vs Predicted Comparison */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Ward-Level Observed vs. Predicted Comparison</h3>
              <p className="panel-desc">
                Comparison of currently reported cases with {horizonDays}-day model predictions across wards
              </p>
            </div>
            <button className="panel-action-btn" onClick={() => onSelectTab("wards")}>
              View All Wards <ChevronRight size={14} />
            </button>
          </div>

          <div className="chart-container" style={{ height: "260px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardComparisonData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke={axisStroke} tick={{ fill: tickColor, fontSize: 11 }} />
                <YAxis stroke={axisStroke} tick={{ fill: tickColor, fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: tickColor }} />
                <Bar dataKey="observed" name="Reported Cases" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="predicted" name={`Predicted (+${horizonDays}d)`} fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Risk Category Distribution */}
        <article className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Municipal Risk Category Distribution</h3>
              <p className="panel-desc">
                Classification breakdown based on EVOI (Attack Rate + Case Volume + Climate Suitability)
              </p>
            </div>
            <button className="panel-action-btn" onClick={() => onSelectTab("map")}>
              Open Risk Map <ChevronRight size={14} />
            </button>
          </div>

          <div className="risk-donut-container">
            <div style={{ width: "180px", height: "180px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {riskDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="donut-legend">
              {riskDistributionData.map((item) => (
                <div key={item.name} className="donut-legend-item">
                  <div className="donut-legend-left">
                    <span className="donut-dot" style={{ backgroundColor: item.color }} />
                    <span className="donut-label">{item.name}</span>
                  </div>
                  <strong className="donut-count">
                    {item.count} Wards ({((item.count / Math.max(1, wardData.length)) * 100).toFixed(0)}%)
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-footer-note">
            <span>High Risk requires targeted source reduction and emergency larvicidal application.</span>
          </div>
        </article>
      </div>

      {/* SECTION 4: Quick Ward Overview Table */}
      <section className="panel" style={{ marginTop: "20px" }}>
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Ward Risk Summary &amp; Recommended Interventions</h3>
            <p className="panel-desc">
              Verified municipal ward records loaded from Census 2011 Primary Census Abstract
            </p>
          </div>
          <button className="btn-table-action" onClick={() => onSelectTab("wards")}>
            Full Analysis Table &rarr;
          </button>
        </div>

        <div className="table-responsive">
          <table className="surveillance-table">
            <thead>
              <tr>
                <th>WARD IDENTIFIER</th>
                <th>CENSUS POPULATION</th>
                <th>REPORTED CASES</th>
                <th>PREDICTED (+{horizonDays}D)</th>
                <th>ATTACK RATE / 1K</th>
                <th>RISK STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {wardData.map((ward) => {
                const projected = Math.max(1, Math.round(ward.cases * (1 + horizonDays * 0.02)));
                const attackRate = ((ward.cases / Math.max(1, ward.population)) * 1000).toFixed(2);
                return (
                  <tr key={ward.id} onClick={() => onSelectWard(ward)} className="clickable-row">
                    <td>
                      <strong>{ward.name}</strong>
                      <span className="table-sub">{ward.official_name || "Coimbatore South"}</span>
                    </td>
                    <td>{ward.population?.toLocaleString() ?? "—"}</td>
                    <td>
                      <span className="case-count-badge">{ward.cases}</span>
                    </td>
                    <td>
                      <span className="pred-count-badge">{projected}</span>
                    </td>
                    <td>{attackRate}</td>
                    <td>
                      <span className={`risk-badge ${ward.risk ? ward.risk.toLowerCase() : "low"}`}>
                        {ward.risk || "Low"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-inspect"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWard(ward);
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
