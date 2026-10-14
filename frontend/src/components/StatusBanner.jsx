import React from "react";
import { ShieldCheck, AlertTriangle, Info, Database } from "lucide-react";

export default function StatusBanner({
  isLiveConnected,
  modelReady,
  modelStatusNote,
  district = "Coimbatore",
  dataSource = "Census 2011 PCA",
}) {
  return (
    <div className="status-banner">
      <div className="status-banner-left">
        <span className="region-tag">
          <Database size={13} />
          {district} Municipal Area · {dataSource}
        </span>

        {isLiveConnected ? (
          <span className="engine-tag engine-live">
            <ShieldCheck size={13} />
            Live FastAPI Connected (Port 8000)
          </span>
        ) : (
          <span className="engine-tag engine-warning">
            <AlertTriangle size={13} />
            Offline / Connecting to Backend...
          </span>
        )}

        <span
          className={`engine-tag ${
            modelReady ? "engine-ml" : "engine-baseline"
          }`}
          title={modelStatusNote}
        >
          <Info size={13} />
          {modelReady
            ? "Trained ML Model Inference Active"
            : "Epidemiological Transmission Baseline Active"}
        </span>
      </div>

      <div className="status-banner-right">
        <span className="freshness-text">
          Target: Municipal Ward Outbreak Early Warning
        </span>
      </div>
    </div>
  );
}
