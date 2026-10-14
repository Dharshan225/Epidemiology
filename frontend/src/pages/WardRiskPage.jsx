import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  TrendingUp,
  ShieldAlert,
  Info,
  ChevronRight,
  Eye,
  Activity,
  Layers,
} from "lucide-react";

export default function WardRiskPage({
  wardData = [],
  riskAssessment,
  clustersData,
  weather,
  horizonDays = 7,
  selectedDisease = "Dengue",
  onSelectWard,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [sortField, setSortField] = useState("predicted");
  const [sortDirection, setSortDirection] = useState("desc");

  // Merge ward demographics with risk assessment items and K-Means clusters
  const enrichedWards = useMemo(() => {
    return wardData.map((w) => {
      const riskItem = riskAssessment?.wards?.find(
        (r) => r.ward_name.toLowerCase() === w.name.toLowerCase()
      );
      const clusterMatch = clustersData?.clustered_wards?.find(
        (cw) => cw.ward_id === w.id || cw.ward_name.toLowerCase() === w.name.toLowerCase()
      );
      const predicted = Math.max(1, Math.round(w.cases * (1 + horizonDays * 0.02)));
      const attackRate = riskItem
        ? riskItem.attack_rate_per_1000
        : Number(((w.cases / Math.max(1, w.population)) * 1000).toFixed(2));
      const compositeScore = riskItem ? riskItem.composite_risk_score : 50;

      const clusterLabel = clusterMatch?.cluster_label || (w.risk === "High" ? "Cluster A: Outbreak Epicenter" : w.risk === "Medium" ? "Cluster B: Transmission Transit Hub" : "Cluster C: Controlled Perimeter");
      const clusterColor = clusterMatch?.cluster_color || (w.risk === "High" ? "#ef4444" : w.risk === "Medium" ? "#f59e0b" : "#10b981");
      const fallbackMobility = { 1: 0.88, 2: 0.82, 3: 0.65, 4: 0.42, 5: 0.60, 6: 0.70, 7: 0.68, 8: 0.85, 9: 0.75, 10: 0.58 };
      const mobilityIndex = clusterMatch?.mobility_index ?? (fallbackMobility[w.id] || 0.55);

      return {
        ...w,
        predicted,
        attackRate,
        compositeScore,
        clusterLabel,
        clusterColor,
        mobilityIndex,
        recommendation:
          clusterMatch?.cluster_action ||
          riskItem?.recommendation ||
          "Standard surveillance and municipal sanitation protocol.",
      };
    });
  }, [wardData, riskAssessment, clustersData, horizonDays]);

  // Filtering
  const filteredWards = useMemo(() => {
    return enrichedWards.filter((w) => {
      const matchesSearch =
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (w.official_name &&
          w.official_name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesRisk =
        riskFilter === "ALL" ||
        w.risk?.toUpperCase() === riskFilter.toUpperCase();
      return matchesSearch && matchesRisk;
    });
  }, [enrichedWards, searchTerm, riskFilter]);

  // Sorting
  const sortedWards = useMemo(() => {
    return [...filteredWards].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === "name") {
        return sortDirection === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [filteredWards, sortField, sortDirection]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  return (
    <div className="page-content">
      <div className="page-header-block">
        <div>
          <span className="eyebrow-pill">PREDICTIVE MODELING &amp; WARD EVALUATION</span>
          <h1 className="page-title">Ward Risk &amp; Vulnerability Analysis</h1>
          <p className="page-subtitle">
            Evaluating disease transmission dynamics across Coimbatore Municipal Corporation wards
            using Census 2011 population records and the Epidemiological Vector-Borne Outbreak Index (EVOI).
          </p>
        </div>
      </div>

      {/* Methodology Card */}
      <div className="methodology-card">
        <div className="methodology-header">
          <Layers size={18} className="text-cyan" />
          <strong>Epidemiological Risk Classification (EVOI)</strong>
        </div>
        <p className="methodology-desc">
          Wards are evaluated using the composite EVOI score (60% case volume &amp; attack rate, 40% climate suitability). High Risk (&ge; 65 or &ge; 24 cases) mandates targeted larviciding, fogging, and fever screening.
        </p>
      </div>

      {/* Spatial-Epidemiological Clustering */}
      <div className="cluster-summary-grid">
        {(clustersData?.cluster_profiles || [
          { cluster_id: 0, label: "Cluster A: Outbreak Epicenter", action_protocol: "Emergency Vector Control & Transit Sanitization", color: "#ef4444", ward_count: 3, mean_evoi_score: 72.5 },
          { cluster_id: 1, label: "Cluster B: Transmission Transit Hub", action_protocol: "Intensified Larviciding & Door-to-Door Fever Survey", color: "#f59e0b", ward_count: 4, mean_evoi_score: 54.0 },
          { cluster_id: 2, label: "Cluster C: Controlled Perimeter", action_protocol: "Routine Sanitation & Source Reduction", color: "#10b981", ward_count: 3, mean_evoi_score: 28.0 }
        ]).map((cp) => (
          <div key={cp.cluster_id} className="cluster-card" style={{ "--cluster-accent": cp.color }}>
            <div className="cluster-card-header">
              <span className="cluster-badge" style={{ color: cp.color }}>
                <span className="cluster-dot" style={{ backgroundColor: cp.color }} />
                Cluster {String.fromCharCode(65 + cp.cluster_id)}
              </span>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)" }}>
                {cp.ward_count} Wards · Mean EVOI {cp.mean_evoi_score}
              </span>
            </div>
            <div className="cluster-card-title">{cp.label.replace(/\s*\(.*?\)/, "")}</div>
            <div className="cluster-card-action">
              <strong>Action:</strong> {cp.action_protocol}
            </div>
          </div>
        ))}
      </div>

      {/* Controls & Search Bar */}
      <div className="table-controls-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by ward name or census designation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-pill-group">
          {["ALL", "HIGH", "MEDIUM", "LOW"].map((lvl) => (
            <button
              key={lvl}
              className={`filter-pill-btn ${riskFilter === lvl ? "active" : ""}`}
              onClick={() => setRiskFilter(lvl)}
            >
              {lvl === "ALL" ? "All Categories" : `${lvl} Risk`}
            </button>
          ))}
        </div>
      </div>

      {/* Main Ward Risk Table */}
      <div className="panel" style={{ padding: "0", overflow: "hidden" }}>
        <div className="table-responsive">
          <table className="surveillance-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort("id")} className="sortable-th">
                  <span>WARD ID</span>
                  <ArrowUpDown size={12} />
                </th>
                <th onClick={() => toggleSort("name")} className="sortable-th">
                  <span>MUNICIPAL WARD</span>
                  <ArrowUpDown size={12} />
                </th>
                <th onClick={() => toggleSort("population")} className="sortable-th">
                  <span>POPULATION (2011)</span>
                  <ArrowUpDown size={12} />
                </th>
                <th onClick={() => toggleSort("cases")} className="sortable-th">
                  <span>OBSERVED CASES</span>
                  <ArrowUpDown size={12} />
                </th>
                <th onClick={() => toggleSort("predicted")} className="sortable-th">
                  <span>PREDICTED (+{horizonDays}D)</span>
                  <ArrowUpDown size={12} />
                </th>
                <th onClick={() => toggleSort("attackRate")} className="sortable-th">
                  <span>ATTACK RATE / 1K</span>
                  <ArrowUpDown size={12} />
                </th>
                <th onClick={() => toggleSort("compositeScore")} className="sortable-th">
                  <span>EVOI SCORE</span>
                  <ArrowUpDown size={12} />
                </th>
                <th>CLUSTER &amp; MOBILITY</th>
                <th>RISK CATEGORY</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {sortedWards.length > 0 ? (
                sortedWards.map((ward) => (
                  <tr
                    key={ward.id}
                    onClick={() => onSelectWard(ward)}
                    className="clickable-row"
                  >
                    <td>
                      <span className="ward-id-tag">W-{ward.id.toString().padStart(2, "0")}</span>
                    </td>
                    <td>
                      <strong>{ward.name}</strong>
                      <span className="table-sub">{ward.official_name || "Coimbatore South"}</span>
                    </td>
                    <td>{ward.population?.toLocaleString() ?? "N/A"}</td>
                    <td>
                      <span className="case-count-badge">{ward.cases}</span>
                    </td>
                    <td>
                      <span className="pred-count-badge">{ward.predicted}</span>
                    </td>
                    <td>
                      <strong>{ward.attackRate}</strong>
                    </td>
                    <td>
                      <div className="score-meter">
                        <span className="score-num">{ward.compositeScore}</span>
                        <div className="score-bar-bg">
                          <div
                            className="score-bar-fill"
                            style={{
                              width: `${Math.min(100, ward.compositeScore)}%`,
                              backgroundColor: ward.color || "#06b6d4",
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span className="cluster-badge" style={{ color: ward.clusterColor }}>
                          <span className="cluster-dot" style={{ backgroundColor: ward.clusterColor }} />
                          {ward.clusterLabel?.split(":")[0] || "Cluster"}
                        </span>
                        <span className="mobility-badge" title="Commuter transit mobility index">
                          Transit: {(ward.mobilityIndex * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
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
                        <Eye size={13} />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="table-empty-cell">
                    <Info size={20} />
                    <p>No municipal wards matched your search criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer-bar">
          <span>
            Showing <strong>{sortedWards.length}</strong> of <strong>{wardData.length}</strong> monitored wards
          </span>
          <span className="text-muted">
            Click any row to open the complete ward epidemiological dossier
          </span>
        </div>
      </div>
    </div>
  );
}
