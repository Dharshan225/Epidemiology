import React from "react";
import { Filter, RefreshCw, Calendar, MapPin, Bug } from "lucide-react";

export default function FilterBar({
  selectedDistrict,
  setSelectedDistrict,
  selectedDisease,
  setSelectedDisease,
  selectedHorizon,
  setSelectedHorizon,
  selectedWard,
  setSelectedWard,
  wards = [],
  onRefresh,
  loading = false,
}) {
  const supportedDiseases = ["Dengue", "Malaria", "Chikungunya"];
  const supportedHorizons = [
    { days: 7, label: "Next 7 Days (1 Week)" },
    { days: 14, label: "Next 14 Days (2 Weeks)" },
    { days: 21, label: "Next 21 Days (3 Weeks)" },
  ];

  return (
    <div className="filter-bar">
      <div className="filter-title">
        <Filter size={16} />
        <span>Surveillance Filters</span>
      </div>

      <div className="filter-group">
        {/* District Filter */}
        <div className="filter-item">
          <label htmlFor="district-select">
            <MapPin size={13} />
            <span>District</span>
          </label>
          <select
            id="district-select"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="filter-select"
          >
            <option value="Coimbatore">Coimbatore (District 3331)</option>
          </select>
        </div>

        {/* Disease Filter */}
        <div className="filter-item">
          <label htmlFor="disease-select">
            <Bug size={13} />
            <span>Disease</span>
          </label>
          <select
            id="disease-select"
            value={selectedDisease}
            onChange={(e) => setSelectedDisease(e.target.value)}
            className="filter-select"
          >
            {supportedDiseases.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Forecast Horizon Filter */}
        <div className="filter-item">
          <label htmlFor="horizon-select">
            <Calendar size={13} />
            <span>Forecast Horizon</span>
          </label>
          <select
            id="horizon-select"
            value={selectedHorizon}
            onChange={(e) => setSelectedHorizon(Number(e.target.value))}
            className="filter-select"
          >
            {supportedHorizons.map((h) => (
              <option key={h.days} value={h.days}>
                {h.label}
              </option>
            ))}
          </select>
        </div>

        {/* Ward Filter */}
        <div className="filter-item">
          <label htmlFor="ward-select">
            <MapPin size={13} />
            <span>Municipal Ward</span>
          </label>
          <select
            id="ward-select"
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="filter-select"
          >
            <option value="All wards">All Wards (Cumulative)</option>
            {wards.map((w) => (
              <option key={w.name} value={w.name}>
                {w.name} {w.official_name ? `— ${w.official_name}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-actions">
        <button
          className="btn-refresh"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh surveillance data from backend"
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          <span>{loading ? "Updating..." : "Refresh Data"}</span>
        </button>
      </div>
    </div>
  );
}
