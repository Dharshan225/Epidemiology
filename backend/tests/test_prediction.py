import pytest

def test_unauthenticated_predict_rejected(auth_headers):
    from fastapi.testclient import TestClient
    from backend.main import app
    unauth_client = TestClient(app)
    response = unauth_client.post("/api/predict", json={
        "disease": "Dengue",
        "ward": "Ward 01",
        "horizon_days": 7
    })
    assert response.status_code == 401

def test_predict_valid_request(auth_client):
    payload = {
        "disease": "Dengue",
        "ward": "Ward 01",
        "horizon_days": 7,
        "temperature": 29.0,
        "rainfall": 42.0,
        "humidity": 78.0
    }
    response = auth_client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["disease"] == "Dengue"
    assert data["ward"] == "Ward 01"
    assert data["horizon_days"] == 7
    assert data["predicted_cases"] is not None
    assert data["rounded_prediction"] >= 0
    assert data["risk_level"] in ["High", "Medium", "Low"]

def test_predict_all_wards(auth_client):
    payload = {
        "disease": "Dengue",
        "ward": "All wards",
        "horizon_days": 14
    }
    response = auth_client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["horizon_days"] == 14
    assert data["rounded_prediction"] is not None

def test_predict_unsupported_disease(auth_client):
    payload = {
        "disease": "Ebola",
        "ward": "Ward 01",
        "horizon_days": 7
    }
    response = auth_client.post("/api/predict", json=payload)
    assert response.status_code == 400
    assert "Unsupported disease" in response.json()["detail"]

def test_predict_unsupported_horizon(auth_client):
    payload = {
        "disease": "Dengue",
        "ward": "Ward 01",
        "horizon_days": 45
    }
    response = auth_client.post("/api/predict", json=payload)
    assert response.status_code == 400
    assert "Horizon of 45 days is unsupported" in response.json()["detail"]

def test_predict_nonexistent_ward(auth_client):
    payload = {
        "disease": "Dengue",
        "ward": "Ward 999",
        "horizon_days": 7
    }
    response = auth_client.post("/api/predict", json=payload)
    assert response.status_code == 400
    assert "not found in Coimbatore" in response.json()["detail"]

def test_forecast_series_endpoint(auth_client):
    response = auth_client.get("/api/forecast?disease=Dengue&ward=All%20wards&horizon_days=7")
    assert response.status_code == 200
    data = response.json()
    assert "series" in data
    assert len(data["series"]) >= 5
    assert data["series"][-1]["predicted"] is not None
