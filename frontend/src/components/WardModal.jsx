import React from "react";
import { X, Users, Home, AlertCircle, Thermometer, CloudRain, Wind, TrendingUp, ShieldAlert } from "lucide-react";

export default function WardModal({ ward, riskInfo, weather, onClose, onSelectForForecast }) {
  if (!ward) return null;

  const attackRate = riskInfo?.attack_rate_per_1000 ?? ((ward.cases / Math.max(1, ward.population)) * 1000).toFixed(2);
  const compositeScore = riskInfo?.composite_risk_score ?? "N/A";
  const recommendation = riskInfo?.recommendation ?? "Standard municipal sanitation and active fever surveillance.";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">MUNICIPAL WARD PROFILE</div>
            <h2 className="modal-title">{ward.name}</h2>
            <p className="modal-subtitle">{ward.official_name || "Coimbatore Municipal Corporation"}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Key Metric Badges */}
          <div className="modal-stat-grid">
            <div className="modal-stat-box">
              <span className="stat-label">Reported Cases</span>
              <strong className="stat-val">{ward.cases ?? 0}</strong>
              <small className="stat-sub">Active surveillance</small>
            </div>

            <div className="modal-stat-box">
              <span className="stat-label">Attack Rate</span>
              <strong className="stat-val">{attackRate}</strong>
              <small className="stat-sub">Per 1,000 population</small>
            </div>

            <div className="modal-stat-box">
              <span className="stat-label">EVOI Risk Level</span>
              <span className={`risk-pill ${ward.risk ? ward.risk.toLowerCase() : "low"}`}>
                {ward.risk || "Low"}
              </span>
              <small className="stat-sub">Score: {compositeScore}/100</small>
            </div>

            <div className="modal-stat-box">
              <span className="stat-label">Census Population</span>
              <strong className="stat-val">{ward.population?.toLocaleString() ?? "N/A"}</strong>
              <small className="stat-sub">Census 2011 PCA</small>
            </div>
          </div>

          {/* Demographic & Geographical details */}
          <div className="modal-section">
            <h4 className="section-title">Demographic & Census Context</h4>
            <div className="info-grid">
              <div className="info-item">
                <Users size={16} />
                <div>
                  <span className="info-k">Total Population</span>
                  <strong className="info-v">{ward.population?.toLocaleString() ?? "N/A"}</strong>
                </div>
              </div>
              <div className="info-item">
                <Home size={16} />
                <div>
                  <span className="info-k">Households</span>
                  <strong className="info-v">{ward.households?.toLocaleString() ?? "N/A"}</strong>
                </div>
              </div>
              <div className="info-item">
                <Users size={16} />
                <div>
                  <span className="info-k">Children (0-6 Years)</span>
                  <strong className="info-v">{ward.child_population?.toLocaleString() ?? "N/A"}</strong>
                </div>
              </div>
              <div className="info-item">
                <ShieldAlert size={16} />
                <div>
                  <span className="info-k">Geographic Centroid</span>
                  <strong className="info-v">
                    {ward.position ? `${ward.position[0].toFixed(4)}°N, ${ward.position[1].toFixed(4)}°E` : "Coimbatore South"}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Public Health Action Recommendation */}
          <div className="modal-section alert-box">
            <div className="alert-box-header">
              <AlertCircle size={18} className="text-cyan" />
              <strong>Recommended Public Health Intervention Protocol</strong>
            </div>
            <p className="alert-box-body">{recommendation}</p>
          </div>

          {/* Environmental Conditions */}
          {weather && (
            <div className="modal-section">
              <h4 className="section-title">Ambient Environmental Indicators</h4>
              <div className="env-grid">
                <div className="env-chip">
                  <Thermometer size={15} />
                  <span>Temp: {weather.temperature_c ?? weather.temperatureC}°C</span>
                </div>
                <div className="env-chip">
                  <CloudRain size={15} />
                  <span>Rain: {weather.rainfall_mm ?? weather.rainfallMm} mm</span>
                </div>
                <div className="env-chip">
                  <Wind size={15} />
                  <span>Humidity: {weather.humidity_pct ?? weather.humidityPct}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              onSelectForForecast(ward.name);
              onClose();
            }}
          >
            <TrendingUp size={15} />
            Run Multi-Horizon Forecast for {ward.name}
          </button>
        </div>
      </div>
    </div>
  );
}
