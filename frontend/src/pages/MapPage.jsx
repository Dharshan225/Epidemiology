import React from "react";
import {
  MapPin,
  Layers,
  Info,
  Calendar,
  Bug,
  Compass,
  Maximize2,
  Building,
} from "lucide-react";
import DiseaseMap from "../DiseaseMap";

export default function MapPage({
  wardData = [],
  clustersData,
  selectedDistrict = "Coimbatore",
  selectedDisease = "Dengue",
  horizonDays = 7,
  selectedWardName = "All wards",
  onSelectWard,
  theme = "dark",
}) {
  return (
    <div className="page-content">
      <div className="page-header-block">
        <div>
          <span className="eyebrow-pill">GEOGRAPHICAL INFORMATION SYSTEM (GIS)</span>
          <h1 className="page-title">Ward-Level Disease Risk Heat Map</h1>
          <p className="page-subtitle">
            Spatially referenced epidemiological risk distribution across Coimbatore Municipal Corporation.
            Marker radius scales with active case load and color corresponds to the EVOI risk classification.
          </p>
        </div>
      </div>

      {/* Map Control Bar & Information */}
      <div className="map-view-card">
        <div className="map-card-header">
          <div className="map-header-left">
            <Compass size={18} className="text-cyan" />
            <div>
              <h3>Coimbatore Municipal Corporation (District 3331)</h3>
              <p>
                Spatial coordinate frame: WGS84 · Base Map: OpenStreetMap (No API Key Required)
              </p>
            </div>
          </div>
          <div className="map-header-tags">
            <span className="map-chip">
              <Bug size={13} />
              {selectedDisease}
            </span>
            <span className="map-chip">
              <Calendar size={13} />
              +{horizonDays} Days Horizon
            </span>
          </div>
        </div>

        {/* The Leaflet Map Component */}
        <DiseaseMap
          wards={wardData}
          clustersData={clustersData}
          onSelectWard={onSelectWard}
          selectedWardName={selectedWardName}
          horizonDays={horizonDays}
          theme={theme}
        />

        {/* Legend Strip */}
        <div className="map-legend-strip">
          <div className="legend-group">
            <span className="legend-title">EVOI Risk Classification:</span>
            <div className="legend-item">
              <span className="legend-circle high" />
              <span>High Risk (&ge; 24 cases / Score &ge; 65)</span>
            </div>
            <div className="legend-item">
              <span className="legend-circle medium" />
              <span>Medium Risk (15–23 cases / Score 40–64)</span>
            </div>
            <div className="legend-item">
              <span className="legend-circle low" />
              <span>Low Risk (&lt; 15 cases / Score &lt; 40)</span>
            </div>
          </div>

          <div className="legend-group">
            <span className="legend-title">Spatial Clustering &amp; Mobility:</span>
            <span className="legend-desc">
              K-Means clusters combine attack rate, EVOI risk, and arterial transit mobility corridors.
            </span>
          </div>
        </div>

        {/* Geographical Provenance & Attribution Disclosure */}
        <div className="map-disclosure-box">
          <Info size={16} className="text-cyan flex-shrink-0" />
          <p>
            <strong>Geographical Boundary &amp; Demographic Integrity:</strong> Ward centroid coordinates are derived from
            official Census of India 2011 Primary Census Abstract (PCA 3331) records. In compliance with data integrity protocols,
            individual polygon shapefile boundary files are not synthesized; point centroids with buffered transmission radii
            are accurately displayed. External map tiles courtesy of OpenStreetMap contributors &copy; CARTO.
          </p>
        </div>
      </div>

      {/* Ward Cards Grid Below Map */}
      <div className="map-ward-cards-section">
        <h3 className="section-title">Municipal Ward Quick Selection</h3>
        <div className="map-ward-grid">
          {wardData.map((ward) => {
            const isSelected =
              selectedWardName &&
              selectedWardName.toLowerCase() === ward.name.toLowerCase();
            const predicted = Math.max(1, Math.round(ward.cases * (1 + horizonDays * 0.02)));
            const clusterMatch = clustersData?.clustered_wards?.find(
              (cw) => cw.ward_id === ward.id || cw.ward_name.toLowerCase() === ward.name.toLowerCase()
            );

            return (
              <button
                key={ward.id}
                className={`map-ward-card ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectWard(ward)}
              >
                <div className="ward-card-header">
                  <span className="ward-pill">{ward.name}</span>
                  <span className={`risk-badge ${ward.risk?.toLowerCase()}`}>
                    {ward.risk}
                  </span>
                </div>
                <strong className="ward-cases">{ward.cases} Reported Cases</strong>
                <span className="ward-predicted">
                  Projected (+{horizonDays}d): {predicted} cases
                </span>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                  <span className="cluster-badge" style={{ fontSize: "10px", padding: "1px 6px" }}>
                    <span className="cluster-dot" style={{ backgroundColor: clusterMatch?.cluster_color || ward.color || "#06b6d4" }} />
                    {clusterMatch?.cluster_label?.split(":")[0] || `Cluster ${ward.risk === "High" ? "A" : ward.risk === "Medium" ? "B" : "C"}`}
                  </span>
                  <span className="mobility-badge" style={{ fontSize: "10px", padding: "1px 5px" }}>
                    Transit: {((clusterMatch?.mobility_index ?? 0.6) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="ward-pop-row" style={{ marginTop: "6px" }}>
                  <span>Pop: {ward.population?.toLocaleString() ?? "N/A"}</span>
                  <span className="click-hint">Inspect &rarr;</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
