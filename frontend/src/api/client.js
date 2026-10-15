/**
 * Centralized API Service for OutbreakWatch AI Disease Surveillance Platform
 * Strictly maps to backend FastAPI endpoints with timeout, error handling,
 * and transparent connection health verification.
 */

const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    if (
      window.location.port !== "5173" ||
      (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1")
    ) {
      return window.location.origin;
    }
  }
  return import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
};

const API_BASE_URL = getApiBaseUrl();
const DEFAULT_TIMEOUT_MS = 8000;

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, headers: customHeaders, ...fetchOptions } = options;
  const headers = new Headers(customHeaders || {});

  // Automatically attach authenticated municipal officer session token
  try {
    const saved = localStorage.getItem("epidemiology_officer");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.token) {
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${parsed.token}`);
        }
        if (!headers.has("X-Officer-Token")) {
          headers.set("X-Officer-Token", parsed.token);
        }
      }
    }
  } catch {}

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
    clearTimeout(id);

    // If session expired or unauthorized on protected APIs, notify
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("epidemiology_unauthorized"));
    }

    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeout / 1000}s`);
    }
    throw error;
  }
}

export const api = {
  getBaseUrl() {
    return API_BASE_URL;
  },

  /**
   * GET /api/health
   * Detailed health inspection of all services and ML model artifact loading state
   */
  async getHealth() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/health`);
    if (!res.ok) {
      throw new Error(`Health check failed with status ${res.status}`);
    }
    return res.json();
  },

  /**
   * GET /api/dashboard
   * Consolidated surveillance dashboard data
   */
  async getDashboard(ward = "All wards", disease = "Dengue") {
    const params = new URLSearchParams({
      ward: ward || "All wards",
      disease: disease || "Dengue",
    });
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/dashboard?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch dashboard data (${res.status})`);
    }
    return res.json();
  },

  /**
   * GET /api/alerts
   * Active outbreak warning alerts
   */
  async getAlerts() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts`);
    if (!res.ok) {
      throw new Error(`Failed to fetch alerts (${res.status})`);
    }
    return res.json();
  },


  /**
   * GET /api/wards
   * Verified municipal ward demographics from Census 2011 PCA
   */
  async getWards() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/wards`);
    if (!res.ok) {
      throw new Error(`Failed to fetch wards (${res.status})`);
    }
    return res.json();
  },

  /**
   * GET /api/risk
   * Epidemiological risk evaluation (EVOI index, attack rate, composite score)
   */
  async getRiskAssessment(disease = "Dengue") {
    const params = new URLSearchParams({ disease });
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/risk?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch risk assessment (${res.status})`);
    }
    return res.json();
  },

  /**
   * GET /api/forecast
   * Multi-week chronological surveillance series and forecast step
   */
  async getForecast(disease = "Dengue", ward = "All wards", horizonDays = 7) {
    const params = new URLSearchParams({
      disease,
      ward: ward || "All wards",
      horizon_days: String(horizonDays),
    });
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/forecast?${params.toString()}`);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || `Forecast request failed (${res.status})`);
    }
    return res.json();
  },

  /**
   * GET /api/weather
   * Live ambient meteorological observations (Open-Meteo)
   */
  async getWeather(options = {}) {
    const { ward, latitude, longitude, force_refresh = false } = options;
    const params = new URLSearchParams();
    if (ward && ward !== "All wards") params.append("ward", ward);
    if (latitude !== undefined && latitude !== null) params.append("latitude", String(latitude));
    if (longitude !== undefined && longitude !== null) params.append("longitude", String(longitude));
    if (force_refresh) params.append("force_refresh", "true");

    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/weather${qs}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch weather (${res.status})`);
    }
    return res.json();
  },

  /**
   * POST /api/predict
   * Run inference using ML model or epidemiological baseline
   */
  async predictCases({
    disease = "Dengue",
    ward = "All wards",
    horizon_days = 7,
    temperature = null,
    rainfall = null,
    humidity = null,
  }) {
    const payload = {
      disease,
      ward,
      horizon_days,
    };
    if (temperature !== null && !isNaN(temperature)) payload.temperature = Number(temperature);
    if (rainfall !== null && !isNaN(rainfall)) payload.rainfall = Number(rainfall);
    if (humidity !== null && !isNaN(humidity)) payload.humidity = Number(humidity);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || errBody.message || `Prediction request failed (${res.status})`);
    }
    return res.json();
  },

  /**
   * GET /api/model/metrics
   * Genuine model evaluation metrics (MAE, RMSE, R²)
   */
  async getModelMetrics() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/model/metrics`);
    if (!res.ok) {
      throw new Error(`Failed to fetch model metrics (${res.status})`);
    }
    return res.json();
  },

  /**
   * GET /api/clusters
   * K-Means spatial epidemiological clustering combining attack rate, mobility, & density
   */
  async getClusters(disease = "Dengue") {
    const params = new URLSearchParams({ disease });
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/clusters?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch clusters (${res.status})`);
    }
    return res.json();
  },

  /**
   * POST /api/auth/login
   * Authenticate municipal officer with email ID and contact number
   */
  async loginAdmin({ email, contact_number, name = null, password = null }) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, contact_number, name, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `Login failed (${res.status})`);
    }
    return res.json();
  },

  /**
   * GET /api/auth/officer
   * Fetch currently registered municipal officer profile
   */
  async getCurrentOfficer() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/auth/officer`);
    if (!res.ok) {
      throw new Error(`Failed to fetch officer profile (${res.status})`);
    }
    return res.json();
  },

  /**
   * POST /api/auth/logout
   */
  async logoutAdmin() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
    });
    return res.json();
  },

  /**
   * POST /api/alerts/dispatch-sms
   * Dispatch high-risk emergency SMS alert to registered contact number
   */
  async dispatchAlertSms({ recipient_phone = null, recipient_name = null, disease = "Dengue", custom_message = null, prediction_date = null, force = false } = {}) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/dispatch-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_phone, recipient_name, disease, custom_message, prediction_date, force }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `SMS dispatch failed (${res.status})`);
    }
    return res.json();
  },

  /**
   * POST /api/alerts/evaluate-thresholds
   * Scan wards against high-risk threshold and send SMS alert
   */
  async evaluateThresholdAlerts(disease = "Dengue", force = false) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/evaluate-thresholds?disease=${encodeURIComponent(disease)}&force=${force}`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `Threshold evaluation failed (${res.status})`);
    }
    return res.json();
  },

  /**
   * GET /api/alerts/sms-history
   * Audit trail of live and failed SMS alerts
   */
  async getSmsHistory() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/sms-history`);
    if (!res.ok) {
      throw new Error(`Failed to fetch SMS history (${res.status})`);
    }
    return res.json();
  },

  /**
   * GET /api/alerts/gateway-status
   * Gateway configuration readiness
   */
  async getGatewayStatus() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/gateway-status`);
    if (!res.ok) {
      throw new Error(`Failed to fetch gateway status (${res.status})`);
    }
    return res.json();
  },

  /**
   * POST /api/alerts/test-sms
   * Single test SMS to authorized municipal officer after configuration
   */
  async sendTestSms(recipient_phone = null, note = null) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/test-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_phone, note }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `Test SMS failed (${res.status})`);
    }
    return res.json();
  },

  /**
   * DELETE /api/alerts/sms-history
   * Clear SMS audit log
   */
  async clearSmsHistory() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/sms-history`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(`Failed to clear SMS history (${res.status})`);
    }
    return res.json();
  },

  /**
   * POST /api/alerts/configure-gateway
   * Direct in-app gateway credential activation (Fast2SMS / Twilio)
   */
  async configureGateway(config) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/configure-gateway`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `Failed to activate gateway (${res.status})`);
    }
    return res.json();
  },

  /**
   * POST /api/alerts/dispatch-email
   * Dispatch high-risk outbreak email alert to authorized municipal officer
   */
  async dispatchAlertEmail(payload = {}) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/dispatch-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `Email dispatch failed (${res.status})`);
    }
    return res.json();
  },

  /**
   * POST /api/alerts/test-email
   * Single verification test email to authorized municipal officer
   */
  async sendTestEmail(recipient_email = null, note = null) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/test-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_email, note }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `Test email failed (${res.status})`);
    }
    return res.json();
  },

  /**
   * GET /api/alerts/email-history
   * Audit trail of live and failed email alerts
   */
  async getEmailHistory() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/email-history`);
    if (!res.ok) {
      throw new Error(`Failed to fetch email history (${res.status})`);
    }
    return res.json();
  },

  /**
   * DELETE /api/alerts/email-history
   */
  async clearEmailHistory() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/email-history`, {
      method: "DELETE",
    });
    return res.json();
  },

  /**
   * GET /api/alerts/smtp-status
   * SMTP server configuration readiness
   */
  async getSmtpStatus() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/smtp-status`);
    if (!res.ok) {
      throw new Error(`Failed to fetch SMTP status (${res.status})`);
    }
    return res.json();
  },

  /**
   * POST /api/alerts/configure-smtp
   */
  async configureSmtp(config) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/alerts/configure-smtp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `Failed to configure SMTP (${res.status})`);
    }
    return res.json();
  },
};
