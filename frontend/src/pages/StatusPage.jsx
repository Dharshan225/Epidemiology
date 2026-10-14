import React, { useState } from "react";
import {
  Server,
  Database,
  CloudRain,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Activity,
  Compass,
} from "lucide-react";
import { api } from "../api/client";

export default function StatusPage({
  isLiveConnected = false,
  healthData,
  modelMetrics,
  weather,
  wardData = [],
  lastSyncTime,
  onRefresh,
}) {
  const [checking, setChecking] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const handlePing = async () => {
    setChecking(true);
    const start = performance.now();
    try {
      const res = await api.getHealth();
      const elapsed = Math.round(performance.now() - start);
      setPingResult({
        ok: true,
        latencyMs: elapsed,
        status: res.status,
        timestamp: res.timestamp,
      });
    } catch (err) {
      setPingResult({
        ok: false,
        error: err.message,
      });
    } finally {
      setChecking(false);
    }
  };

  const modelStatus = healthData?.components?.model_service?.status || (isLiveConnected ? "degraded" : "offline");
  const weatherStatus = healthData?.components?.weather_service?.status || (weather?.is_real ? "ready" : "baseline_fallback");
  const dataStatus = healthData?.components?.data_service?.status || (wardData.length > 0 ? "ready" : "unavailable");

  return (
    <div className="page-content">
      <div className="page-header-block">
        <div>
          <span className="eyebrow-pill">SURVEILLANCE INFRASTRUCTURE HEALTH</span>
          <h1 className="page-title">Data &amp; System Status</h1>
          <p className="page-subtitle">
            Comprehensive diagnostic inspection of the FastAPI backend, Census 2011 demographic data service,
            Open-Meteo meteorological feed, and machine learning inference engine.
          </p>
        </div>
        <button className="btn-primary" onClick={handlePing} disabled={checking}>
          <RefreshCw size={14} className={checking ? "spin" : ""} />
          {checking ? "Probing API..." : "Ping Backend Health"}
        </button>
      </div>

      {pingResult && (
        <div className={`status-probe-banner ${pingResult.ok ? "probe-ok" : "probe-err"}`}>
          {pingResult.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>
            {pingResult.ok
              ? `Backend response received in ${pingResult.latencyMs} ms · Overall Status: ${pingResult.status.toUpperCase()} · Timestamp: ${pingResult.timestamp}`
              : `Backend ping error: ${pingResult.error}`}
          </span>
        </div>
      )}

      {/* Core Component Grid */}
      <div className="status-components-grid">
        {/* Component 1: FastAPI Core */}
        <article className="status-component-card">
          <div className="status-card-header">
            <div className="status-card-icon blue">
              <Server size={22} />
            </div>
            <div>
              <h4>FastAPI Application Core</h4>
              <p>REST API Engine (Port 8000)</p>
            </div>
            <span className={`status-pill ${isLiveConnected ? "status-ok" : "status-err"}`}>
              {isLiveConnected ? "CONNECTED" : "OFFLINE"}
            </span>
          </div>

          <div className="status-card-body">
            <div className="status-row">
              <span>API Base URL:</span>
              <code>{api.getBaseUrl()}</code>
            </div>
            <div className="status-row">
              <span>App Version:</span>
              <strong>{healthData?.version || "1.0.0"}</strong>
            </div>
            <div className="status-row">
              <span>Environment:</span>
              <strong>{healthData?.environment || "development"}</strong>
            </div>
            <div className="status-row">
              <span>Last Successful Sync:</span>
              <strong>{lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : "Pending"}</strong>
            </div>
          </div>
        </article>

        {/* Component 2: ML Model Lifecycle Service */}
        <article className="status-component-card">
          <div className="status-card-header">
            <div className="status-card-icon purple">
              <Cpu size={22} />
            </div>
            <div>
              <h4>Machine Learning Inference Engine</h4>
              <p>PyTorch / Scikit-Learn Model Loader</p>
            </div>
            <span className={`status-pill ${modelStatus === "ready" ? "status-ok" : "status-warn"}`}>
              {modelStatus === "ready" ? "MODEL LOADED" : "BASELINE ACTIVE"}
            </span>
          </div>

          <div className="status-card-body">
            <div className="status-row">
              <span>Model Readiness:</span>
              <strong>{healthData?.model_ready ? "Operational (PyTorch Checkpoint)" : "Baseline Mode"}</strong>
            </div>
            <div className="status-row">
              <span>Engine Status:</span>
              <code>{healthData?.model_status || "ready"}</code>
            </div>
            <div className="status-row">
              <span>Inference Engine:</span>
              <strong>DengueOutbreakForecaster (ResNet)</strong>
            </div>
            <div className="status-row">
              <span>Artifact Location:</span>
              <code>backend/models/dengue_model.pth</code>
            </div>
          </div>
        </article>

        {/* Component 3: Meteorological Service (Open-Meteo) */}
        <article className="status-component-card">
          <div className="status-card-header">
            <div className="status-card-icon cyan">
              <CloudRain size={22} />
            </div>
            <div>
              <h4>Environmental Weather Service</h4>
              <p>Ambient Temperature, Rain &amp; Humidity</p>
            </div>
            <span className={`status-pill ${weatherStatus === "ready" ? "status-ok" : "status-warn"}`}>
              {weatherStatus === "ready" ? "LIVE METEO" : "BASELINE"}
            </span>
          </div>

          <div className="status-card-body">
            <div className="status-row">
              <span>Data Provider:</span>
              <strong>{weather?.source || "Open-Meteo"}</strong>
            </div>
            <div className="status-row">
              <span>Verified Observation:</span>
              <strong>{weather?.is_real ?? weather?.isReal ? "Yes (Real-Time)" : "Climatological Baseline"}</strong>
            </div>
            <div className="status-row">
              <span>Observation Coordinates:</span>
              <strong>{weather?.latitude ? `${weather.latitude.toFixed(4)}°N, ${weather.longitude.toFixed(4)}°E` : "11.0168°N, 76.9558°E"}</strong>
            </div>
            <div className="status-row">
              <span>Station Observation Time:</span>
              <strong>{weather?.observed_at ? new Date(weather.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Active"}</strong>
            </div>
            <div className="status-row">
              <span>API Retrieval Timestamp:</span>
              <strong>{weather?.retrieved_at ? new Date(weather.retrieved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "Live"}</strong>
            </div>
            <div className="status-row">
              <span>Cache Policy:</span>
              <strong>15-Minute Multi-Location TTL</strong>
            </div>
          </div>
        </article>

        {/* Component 4: Municipal Demographics Data Service */}
        <article className="status-component-card">
          <div className="status-card-header">
            <div className="status-card-icon emerald">
              <Database size={22} />
            </div>
            <div>
              <h4>Census Demographics Service</h4>
              <p>Primary Census Abstract (PCA 3331)</p>
            </div>
            <span className={`status-pill ${dataStatus === "ready" ? "status-ok" : "status-err"}`}>
              {dataStatus === "ready" ? "LOADED" : "UNAVAILABLE"}
            </span>
          </div>

          <div className="status-card-body">
            <div className="status-row">
              <span>Census Source:</span>
              <strong>Census of India 2011 (PCA)</strong>
            </div>
            <div className="status-row">
              <span>Excel File Path:</span>
              <code>data/DDW_PCA3331_2011_MDDS with UI.xlsx</code>
            </div>
            <div className="status-row">
              <span>Verified Wards Loaded:</span>
              <strong>{wardData.length} Municipal Corporation Wards</strong>
            </div>
            <div className="status-row">
              <span>Study Population:</span>
              <strong>{wardData.reduce((acc, w) => acc + (w.population || 0), 0).toLocaleString()} (Census Monitored Cohort)</strong>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
