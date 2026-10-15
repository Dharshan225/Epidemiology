import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.auth_service import auth_service

@pytest.fixture
def auth_headers():
    token = auth_service.default_token
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auth_client(auth_headers):
    c = TestClient(app)
    c.headers.update(auth_headers)
    return c
