from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["museworks-agent"]
    protocolVersion: Literal[1] = 1


app = FastAPI()


@app.get("/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="museworks-agent",
        protocolVersion=1,
    )
