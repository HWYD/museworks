from fastapi.testclient import TestClient

from museworks_agent.main import app


def test_health_returns_versioned_service_contract() -> None:
    response = TestClient(app).get("/v1/health")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {
        "status": "ok",
        "service": "museworks-agent",
        "protocolVersion": 1,
    }
    assert isinstance(response.json()["protocolVersion"], int)


def test_run_endpoint_is_not_available() -> None:
    response = TestClient(app).get("/v1/run")

    assert response.status_code == 404
