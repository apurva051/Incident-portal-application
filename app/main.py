import random
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.database import get_connection, initialize_database
from app.models import IncidentCreate, IncidentStatusUpdate


BASE_DIR = Path(__file__).resolve().parent


@asynccontextmanager
async def lifespan(application: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="CloudOps Incident Portal",
    description="Demo incident and service-health management application",
    version="1.0.0",
    lifespan=lifespan,
)

app.mount(
    "/static",
    StaticFiles(directory=BASE_DIR / "static"),
    name="static",
)

templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
    )


@app.get("/health")
def application_health():
    return {
        "status": "healthy",
        "service": "cloudops-portal",
        "version": "1.0.0",
    }


@app.get("/api/incidents")
def get_incidents():
    connection = get_connection()

    rows = connection.execute(
        """
        SELECT *
        FROM incidents
        ORDER BY
            CASE priority
                WHEN 'P1' THEN 1
                WHEN 'P2' THEN 2
                WHEN 'P3' THEN 3
                ELSE 4
            END,
            created_at DESC
        """
    ).fetchall()

    connection.close()

    return [dict(row) for row in rows]


@app.post("/api/incidents", status_code=201)
def create_incident(incident: IncidentCreate):
    connection = get_connection()

    service = connection.execute(
        "SELECT name FROM services WHERE name = ?",
        (incident.service,),
    ).fetchone()

    if service is None:
        connection.close()
        raise HTTPException(status_code=400, detail="Service does not exist")

    cursor = connection.execute(
        """
        INSERT INTO incidents
        (title, service, priority, status, owner, description)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            incident.title,
            incident.service,
            incident.priority,
            "Investigating",
            incident.owner,
            incident.description,
        ),
    )

    incident_id = cursor.lastrowid
    connection.commit()

    created_incident = connection.execute(
        "SELECT * FROM incidents WHERE id = ?",
        (incident_id,),
    ).fetchone()

    connection.close()

    return dict(created_incident)


@app.patch("/api/incidents/{incident_id}/status")
def update_incident_status(
    incident_id: int,
    update: IncidentStatusUpdate,
):
    connection = get_connection()

    incident = connection.execute(
        "SELECT * FROM incidents WHERE id = ?",
        (incident_id,),
    ).fetchone()

    if incident is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Incident not found")

    connection.execute(
        """
        UPDATE incidents
        SET status = ?
        WHERE id = ?
        """,
        (update.status, incident_id),
    )

    connection.commit()

    updated_incident = connection.execute(
        "SELECT * FROM incidents WHERE id = ?",
        (incident_id,),
    ).fetchone()

    connection.close()

    return dict(updated_incident)


@app.get("/api/services")
def get_services():
    connection = get_connection()

    rows = connection.execute(
        "SELECT * FROM services ORDER BY name"
    ).fetchall()

    connection.close()

    return [dict(row) for row in rows]


@app.post("/api/services/{service_id}/health-check")
def run_health_check(service_id: int):
    connection = get_connection()

    service = connection.execute(
        "SELECT * FROM services WHERE id = ?",
        (service_id,),
    ).fetchone()

    if service is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Service not found")

    response_time = random.randint(70, 750)

    if response_time > 500:
        status = "Degraded"
    else:
        status = "Operational"

    if status == "Operational":
        ready_pods = service["total_pods"]
    else:
        ready_pods = max(1, service["total_pods"] - 1)

    connection.execute(
        """
        UPDATE services
        SET status = ?, response_time = ?, ready_pods = ?
        WHERE id = ?
        """,
        (status, response_time, ready_pods, service_id),
    )

    connection.commit()

    updated_service = connection.execute(
        "SELECT * FROM services WHERE id = ?",
        (service_id,),
    ).fetchone()

    connection.close()

    return dict(updated_service)