import React, { useState } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Flame, MapPin, Hospital, Compass, ShieldAlert } from "lucide-react";

// Key Coimbatore Public Health & Geographical Reference Landmarks
const COIMBATORE_LANDMARKS = [
  {
    name: "Coimbatore Medical College Hospital (CMCH)",
    type: "Hospital",
    position: [11.0028, 76.9680],
    desc: "Primary Tertiary Referral & Epidemic Fever Ward Center",
    icon: "🏥",
  },
  {
    name: "Gandhipuram Central Bus Terminus",
    type: "Transit Hub",
    position: [11.0183, 76.9674],
    desc: "Major Inter-District Transit Corridor & Population Movement",
    icon: "🚌",
  },
  {
    name: "Coimbatore Railway Junction",
    type: "Transit Hub",
    position: [10.9972, 76.9632],
    desc: "Southern Railway Division Hub · High Influx Mobility",
    icon: "🚆",
  },
  {
    name: "Ukkadam Periyakulam Lake Zone",
    type: "Water Body / Vector Focus",
    position: [10.9925, 76.9535],
    desc: "Freshwater Wetland & Stagnant Margin Vector Breeding Focus",
    icon: "💧",
  },
  {
    name: "Singanallur Lake & Marshland",
    type: "Water Body / Vector Focus",
    position: [10.9995, 77.0142],
    desc: "Urban Biodiversity Wetland · Monitored Larval Habitat",
    icon: "💧",
  },
];

export default function DiseaseMap({
  wards = [],
  clustersData,
  onSelectWard,
  selectedWardName = "All wards",
  horizonDays = 7,
  theme = "dark",
}) {
  // Center of Coimbatore City, Tamil Nadu
  const defaultCenter = [11.0168, 76.9558];
  const [mapMode, setMapMode] = useState("heat"); // "heat", "markers", "all"
  const [showLandmarks, setShowLandmarks] = useState(true);

  // Official OpenStreetMap tile layer (100% Free, NO API key required, NO watermarks)
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div className="disease-map-wrap">
      {/* Map Control Bar */}
      <div className="map-view-toggle-bar">
        <div className="toggle-group">
          <button
            className={`map-toggle-btn ${mapMode === "heat" ? "active" : ""}`}
            onClick={() => setMapMode("heat")}
            title="Thermal outbreak diffusion field"
          >
            <Flame size={14} />
            <span>Epidemic Heat Map</span>
          </button>
          <button
            className={`map-toggle-btn ${mapMode === "markers" ? "active" : ""}`}
            onClick={() => setMapMode("markers")}
            title="Ward centroid markers"
          >
            <MapPin size={14} />
            <span>Ward Centroids</span>
          </button>
          <button
            className={`map-toggle-btn ${mapMode === "all" ? "active" : ""}`}
            onClick={() => setMapMode("all")}
            title="Combined Heatmap & Ward Markers"
          >
            <ShieldAlert size={14} />
            <span>Combined View</span>
          </button>
        </div>

        <button
          className={`map-toggle-btn landmark-btn ${showLandmarks ? "active" : ""}`}
          onClick={() => setShowLandmarks((prev) => !prev)}
          title="Toggle Coimbatore Hospitals & Transit Hubs"
        >
          <Hospital size={14} />
          <span>{showLandmarks ? "Landmarks Visible" : "Landmarks Hidden"}</span>
        </button>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        className={`disease-map ${theme === "dark" ? "osm-dark-mode" : "osm-light-mode"}`}
      >
        {/* 100% Free OpenStreetMap Tile Layer - Zero API Key Needed */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · Coimbatore Municipal Corporation WGS84'
          url={tileUrl}
          maxZoom={19}
        />

        {/* 1. EPIDEMIOLOGICAL RISK HEAT DIFFUSION LAYERS */}
        {(mapMode === "heat" || mapMode === "all") &&
          wards.map((ward) => {
            const pos = ward.position || [11.0168, 76.9558];
            const isHigh = ward.risk === "High";
            const isMedium = ward.risk === "Medium";

            // Heat diffusion radius and intensities based on active cases & attack rate
            const primaryColor = isHigh ? "#ef4444" : isMedium ? "#f59e0b" : "#10b981";
            const outerRadius = isHigh ? 1600 : isMedium ? 1000 : 650;
            const midRadius = isHigh ? 900 : isMedium ? 550 : 350;
            const coreRadius = isHigh ? 450 : isMedium ? 280 : 180;

            return (
              <React.Fragment key={`heat-${ward.id || ward.name}`}>
                {/* Outermost vector dispersal thermal halo */}
                <Circle
                  center={pos}
                  radius={outerRadius}
                  pathOptions={{
                    color: "transparent",
                    fillColor: primaryColor,
                    fillOpacity: isHigh ? 0.16 : 0.1,
                  }}
                />
                {/* Mid-density cluster contagion zone */}
                <Circle
                  center={pos}
                  radius={midRadius}
                  pathOptions={{
                    color: "transparent",
                    fillColor: primaryColor,
                    fillOpacity: isHigh ? 0.28 : 0.2,
                  }}
                />
                {/* High-intensity outbreak focal core */}
                <Circle
                  center={pos}
                  radius={coreRadius}
                  pathOptions={{
                    color: primaryColor,
                    weight: isHigh ? 2 : 1,
                    fillColor: primaryColor,
                    fillOpacity: isHigh ? 0.45 : 0.32,
                  }}
                />
              </React.Fragment>
            );
          })}

        {/* 2. COIMBATORE HEALTH & TRANSIT LANDMARKS */}
        {showLandmarks &&
          COIMBATORE_LANDMARKS.map((lm) => (
            <CircleMarker
              key={lm.name}
              center={lm.position}
              radius={8}
              pathOptions={{
                color: "#0284c7",
                fillColor: "#38bdf8",
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                <div className="map-tooltip-content">
                  <strong>{lm.icon} {lm.name}</strong>
                  <span>{lm.type} · Coimbatore</span>
                </div>
              </Tooltip>
              <Popup className="custom-popup">
                <div className="popup-box">
                  <div className="popup-header">
                    <h4>{lm.icon} {lm.name}</h4>
                    <span className="popup-risk low">{lm.type}</span>
                  </div>
                  <p className="popup-official">{lm.desc}</p>
                  <div className="popup-note">
                    Coimbatore Public Health Infrastructure Reference Point
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* 3. WARD CENTROIDS AND METRIC DOSSIERS */}
        {(mapMode === "markers" || mapMode === "all" || mapMode === "heat") &&
          wards.map((ward) => {
            const pos = ward.position || [11.0168, 76.9558];
            const isSelected =
              selectedWardName &&
              selectedWardName.toLowerCase() === ward.name.toLowerCase();

            const color =
              ward.color ||
              (ward.risk === "High"
                ? "#ef4444"
                : ward.risk === "Medium"
                ? "#f59e0b"
                : "#10b981");

            const radius = Math.max(16, Math.min(28, 14 + ward.cases * 0.4));
            const predicted = Math.max(1, Math.round(ward.cases * (1 + horizonDays * 0.02)));
            const attackRate = (
              (ward.cases / Math.max(1, ward.population)) *
              1000
            ).toFixed(2);
            const clusterMatch = clustersData?.clustered_wards?.find(
              (cw) => cw.ward_id === ward.id || cw.ward_name.toLowerCase() === ward.name.toLowerCase()
            );

            return (
              <CircleMarker
                key={ward.id || ward.name}
                center={pos}
                radius={isSelected ? radius + 5 : radius}
                pathOptions={{
                  color: isSelected ? "#06b6d4" : "#ffffff",
                  fillColor: color,
                  fillOpacity: isSelected ? 0.95 : 0.82,
                  weight: isSelected ? 3.5 : 2,
                }}
                eventHandlers={{
                  click: () => onSelectWard?.(ward),
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                  <div className="map-tooltip-content">
                    <strong>{ward.name}</strong>
                    <span>{ward.cases} Observed Cases · {ward.risk} Risk</span>
                  </div>
                </Tooltip>

                <Popup className="custom-popup">
                  <div className="popup-box">
                    <div className="popup-header">
                      <h4>{ward.name}</h4>
                      <span className={`popup-risk ${ward.risk?.toLowerCase()}`}>
                        {ward.risk} Risk
                      </span>
                    </div>
                    <p className="popup-official">{ward.official_name || "Coimbatore South"}</p>

                    <div className="popup-stats">
                      <div className="popup-stat-row">
                        <span>Reported Cases:</span>
                        <strong>{ward.cases}</strong>
                      </div>
                      <div className="popup-stat-row">
                        <span>Predicted (+{horizonDays}d):</span>
                        <strong className="text-purple">{predicted}</strong>
                      </div>
                      <div className="popup-stat-row">
                        <span>Attack Rate:</span>
                        <strong>{attackRate} / 1k</strong>
                      </div>
                      <div className="popup-stat-row">
                        <span>Population (2011):</span>
                        <strong>{ward.population?.toLocaleString() ?? "N/A"}</strong>
                      </div>
                      <div className="popup-stat-row">
                        <span>Spatial Cluster:</span>
                        <span className="cluster-badge" style={{ color: clusterMatch?.cluster_color || color, fontSize: "10px", padding: "1px 6px" }}>
                          <span className="cluster-dot" style={{ backgroundColor: clusterMatch?.cluster_color || color }} />
                          {clusterMatch?.cluster_label?.split(":")[0] || `Cluster ${ward.risk === "High" ? "A" : ward.risk === "Medium" ? "B" : "C"}`}
                        </span>
                      </div>
                      <div className="popup-stat-row">
                        <span>Transit Corridor:</span>
                        <span className="mobility-badge" style={{ fontSize: "10px", padding: "1px 5px" }}>
                          Mobility: {((clusterMatch?.mobility_index ?? 0.6) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <button
                      className="btn-popup-inspect"
                      onClick={() => onSelectWard?.(ward)}
                    >
                      View Ward Dossier
                    </button>

                    <div className="popup-note">
                      Census 2011 PCA Centroid · Coimbatore, Tamil Nadu
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
      </MapContainer>
    </div>
  );
}
