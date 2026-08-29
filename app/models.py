from typing import Literal

from pydantic import BaseModel, Field


Priority = Literal["P1", "P2", "P3", "P4"]
IncidentStatus = Literal["Investigating", "Monitoring", "Resolved"]


class IncidentCreate(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    service: str
    priority: Priority
    owner: str = Field(min_length=2, max_length=100)
    description: str = ""


class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus