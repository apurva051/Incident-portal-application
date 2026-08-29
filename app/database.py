import sqlite3
from pathlib import Path

DATABASE_PATH = Path("cloudops.db")


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    connection = get_connection()

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            service TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Investigating',
            owner TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS services IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            environment TEXT NOT NULL,
            status TEXT NOT NULL,
            response_time INTEGER NOT NULL,
            ready_pods INTEGER NOT NULL,
            total_pods INTEGER NOT NULL
        )
        """
    )

    service_count = connection.execute(
        "SELECT COUNT(*) AS total FROM services"
    ).fetchone()["total"]

    if service_count == 0:
        services = [
            ("payment-api", "Production", "Degraded", 684, 3, 4),
            ("checkout-web", "Production", "Operational", 118, 4, 4),
            ("cache-cluster", "Production", "Degraded", 242, 2, 3),
            ("notification-worker", "Production", "Operational", 86, 3, 3),
        ]

        connection.executemany(
            """
            INSERT INTO services
            (name, environment, status, response_time, ready_pods, total_pods)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            services,
        )

    incident_count = connection.execute(
        "SELECT COUNT(*) AS total FROM incidents"
    ).fetchone()["total"]

    if incident_count == 0:
        incidents = [
            (
                "Payment API latency spike",
                "payment-api",
                "P1",
                "Investigating",
                "Apurva",
                "Response time exceeded 600 milliseconds.",
            ),
            (
                "Checkout error rate elevated",
                "checkout-web",
                "P2",
                "Monitoring",
                "Platform Team",
                "Increased HTTP 500 responses detected.",
            ),
            (
                "Redis replica connection drops",
                "cache-cluster",
                "P2",
                "Investigating",
                "Cloud Team",
                "One Redis replica is intermittently unavailable.",
            ),
        ]

        connection.executemany(
            """
            INSERT INTO incidents
            (title, service, priority, status, owner, description)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            incidents,
        )

    connection.commit()
    connection.close()