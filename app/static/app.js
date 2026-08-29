let incidents = [];
let services = [];


document.addEventListener("DOMContentLoaded", async () => {
    configureNavigation();
    configureModal();
    configureIncidentForm();
    configureFilters();

    await refreshApplication();
});


async function refreshApplication() {
    await Promise.all([
        loadIncidents(),
        loadServices(),
    ]);

    renderDashboard();
    renderIncidents();
    renderServices();
}


async function loadIncidents() {
    const response = await fetch("/api/incidents");

    if (!response.ok) {
        showNotification("Could not load incidents");
        return;
    }

    incidents = await response.json();
}


async function loadServices() {
    const response = await fetch("/api/services");

    if (!response.ok) {
        showNotification("Could not load services");
        return;
    }

    services = await response.json();
    populateServiceDropdown();
}


function renderDashboard() {
    const activeIncidents = incidents.filter(
        incident => incident.status !== "Resolved"
    );

    const healthyServices = services.filter(
        service => service.status === "Operational"
    );

    const totalResponseTime = services.reduce(
        (total, service) => total + service.response_time,
        0
    );

    const averageResponseTime = services.length
        ? Math.round(totalResponseTime / services.length)
        : 0;

    document.getElementById("active-incidents").textContent =
        activeIncidents.length;

    document.getElementById("incident-count").textContent =
        activeIncidents.length;

    document.getElementById("healthy-services").textContent =
        `${healthyServices.length} / ${services.length}`;

    document.getElementById("average-response").textContent =
        `${averageResponseTime} ms`;

    const recentContainer =
        document.getElementById("recent-incidents");

    recentContainer.innerHTML = incidents
        .slice(0, 4)
        .map(createIncidentRow)
        .join("");

    const serviceContainer =
        document.getElementById("dashboard-services");

    serviceContainer.innerHTML = services
        .map(createDashboardServiceRow)
        .join("");

    attachResolveButtons();
}


function renderIncidents() {
    const searchValue = document
        .getElementById("incident-search")
        .value
        .trim()
        .toLowerCase();

    const selectedStatus =
        document.getElementById("status-filter").value;

    const filteredIncidents = incidents.filter(incident => {
        const matchesSearch =
            incident.title.toLowerCase().includes(searchValue) ||
            incident.service.toLowerCase().includes(searchValue) ||
            `INC-${incident.id}`.toLowerCase().includes(searchValue);

        const matchesStatus =
            selectedStatus === "All" ||
            incident.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    const container = document.getElementById("incident-list");

    if (filteredIncidents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                No incidents match your search.
            </div>
        `;

        return;
    }

    container.innerHTML = filteredIncidents
        .map(createIncidentRow)
        .join("");

    attachResolveButtons();
}


function createIncidentRow(incident) {
    const action =
        incident.status === "Resolved"
            ? `<span class="status status-Resolved">✓ Resolved</span>`
            : `
                <button
                    class="resolve-button"
                    data-incident-id="${incident.id}"
                >
                    Resolve
                </button>
            `;

    return `
        <article class="incident-row">
            <span class="priority priority-${incident.priority}">
                ${incident.priority}
            </span>

            <div class="incident-information">
                <strong>${escapeHtml(incident.title)}</strong>

                <small>
                    INC-${incident.id} · ${escapeHtml(incident.service)}
                </small>
            </div>

            <span class="status status-${incident.status}">
                ● ${incident.status}
            </span>

            <div class="incident-actions">
                ${action}
            </div>
        </article>
    `;
}


function createDashboardServiceRow(service) {
    const dotClass =
        service.status === "Operational"
            ? "operational-dot"
            : "degraded-dot";

    return `
        <article class="service-row">
            <span class="status-dot ${dotClass}"></span>

            <div>
                <strong>${escapeHtml(service.name)}</strong>
                <small>${escapeHtml(service.environment)}</small>
            </div>

            <div class="service-result">
                <strong>${service.status}</strong>
                <small>${service.response_time} ms</small>
            </div>
        </article>
    `;
}


function renderServices() {
    const container = document.getElementById("service-grid");

    container.innerHTML = services.map(service => {
        const badgeClass =
            service.status === "Operational"
                ? "badge-operational"
                : "badge-degraded";

        return `
            <article class="service-card">
                <div class="service-card-header">
                    <span class="service-icon">
                        SVC
                    </span>

                    <span class="service-badge ${badgeClass}">
                        ${service.status}
                    </span>
                </div>

                <h3>${escapeHtml(service.name)}</h3>

                <p>
                    ${escapeHtml(service.environment)}
                    · Kubernetes service
                </p>

                <div class="service-metrics">
                    <div>
                        <small>Response time</small>
                        <strong>${service.response_time} ms</strong>
                    </div>

                    <div>
                        <small>Ready pods</small>
                        <strong>
                            ${service.ready_pods}/${service.total_pods}
                        </strong>
                    </div>

                    <div>
                        <small>Environment</small>
                        <strong>${service.environment}</strong>
                    </div>
                </div>

                <button
                    class="health-check-button"
                    data-service-id="${service.id}"
                >
                    Run Health Check
                </button>
            </article>
        `;
    }).join("");

    document
        .querySelectorAll(".health-check-button")
        .forEach(button => {
            button.addEventListener("click", async () => {
                await runHealthCheck(button.dataset.serviceId);
            });
        });
}


async function createIncident(event) {
    event.preventDefault();

    const payload = {
        title: document.getElementById("incident-title").value,
        service: document.getElementById("incident-service").value,
        priority: document.getElementById("incident-priority").value,
        owner: document.getElementById("incident-owner").value,
        description:
            document.getElementById("incident-description").value,
    };

    const response = await fetch("/api/incidents", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json();

        showNotification(
            error.detail || "Could not create incident"
        );

        return;
    }

    closeModal();
    document.getElementById("incident-form").reset();
    document.getElementById("incident-owner").value = "Apurva";

    showNotification("Incident created successfully");

    await refreshApplication();
}


async function resolveIncident(incidentId) {
    const response = await fetch(
        `/api/incidents/${incidentId}/status`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                status: "Resolved",
            }),
        }
    );

    if (!response.ok) {
        showNotification("Could not resolve incident");
        return;
    }

    showNotification(`INC-${incidentId} resolved`);

    await refreshApplication();
}


async function runHealthCheck(serviceId) {
    showNotification("Running service health check...");

    const response = await fetch(
        `/api/services/${serviceId}/health-check`,
        {
            method: "POST",
        }
    );

    if (!response.ok) {
        showNotification("Health check failed");
        return;
    }

    const service = await response.json();

    showNotification(
        `${service.name}: ${service.status} (${service.response_time} ms)`
    );

    await refreshApplication();
}


function attachResolveButtons() {
    document
        .querySelectorAll(".resolve-button")
        .forEach(button => {
            button.addEventListener("click", async () => {
                await resolveIncident(
                    button.dataset.incidentId
                );
            });
        });
}


function populateServiceDropdown() {
    const dropdown =
        document.getElementById("incident-service");

    dropdown.innerHTML = services.map(service => {
        return `
            <option value="${service.name}">
                ${service.name}
            </option>
        `;
    }).join("");
}


function configureNavigation() {
    document
        .querySelectorAll(".nav-button")
        .forEach(button => {
            button.addEventListener("click", () => {
                openPage(button.dataset.page);
            });
        });

    document
        .querySelectorAll("[data-open-page]")
        .forEach(button => {
            button.addEventListener("click", () => {
                openPage(button.dataset.openPage);
            });
        });
}


function openPage(pageName) {
    document
        .querySelectorAll(".page")
        .forEach(page => {
            page.classList.remove("active-page");
        });

    document
        .querySelectorAll(".nav-button")
        .forEach(button => {
            button.classList.remove("active");
        });

    document
        .getElementById(`${pageName}-page`)
        .classList.add("active-page");

    document
        .querySelector(`[data-page="${pageName}"]`)
        .classList.add("active");

    const titles = {
        dashboard: "System Overview",
        incidents: "Incident Management",
        services: "Service Health",
    };

    document.getElementById("page-title").textContent =
        titles[pageName];
}


function configureModal() {
    document
        .getElementById("open-modal-button")
        .addEventListener("click", openModal);

    document
        .getElementById("close-modal-button")
        .addEventListener("click", closeModal);

    document
        .getElementById("cancel-button")
        .addEventListener("click", closeModal);

    document
        .getElementById("incident-modal")
        .addEventListener("click", event => {
            if (event.target.id === "incident-modal") {
                closeModal();
            }
        });
}


function openModal() {
    document
        .getElementById("incident-modal")
        .classList.remove("hidden");

    document.getElementById("incident-title").focus();
}


function closeModal() {
    document
        .getElementById("incident-modal")
        .classList.add("hidden");
}


function configureIncidentForm() {
    document
        .getElementById("incident-form")
        .addEventListener("submit", createIncident);
}


function configureFilters() {
    document
        .getElementById("incident-search")
        .addEventListener("input", renderIncidents);

    document
        .getElementById("status-filter")
        .addEventListener("change", renderIncidents);
}


function showNotification(message) {
    const notification =
        document.getElementById("notification");

    notification.textContent = message;
    notification.classList.remove("hidden");

    clearTimeout(window.notificationTimer);

    window.notificationTimer = setTimeout(() => {
        notification.classList.add("hidden");
    }, 3000);
}


function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}