# Operators & Services Reference

All components below run on OpenShift under the Babylon platform. Babylon-owned components are deployed via the Babylon Helm chart. External operators (Poolboy, Anarchy, UserNamespace) are maintained in separate repositories but are runtime dependencies.

---

## Babylon-owned Operators

### agnosticv-operator

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `agnosticv-operator/` |
| **Type** | Kopf (Python) |
| **Namespace** | `babylon-config` |

**Purpose:** Syncs the AgnosticV git repository into Babylon Kubernetes objects. Polls or receives GitHub webhook notifications (port 8090), runs the `agnosticv` CLI to merge the YAML hierarchy for each path×stage, then creates/updates `CatalogItem`, `ResourceProvider`, and `AnarchyGovernor`.

**CRDs owned:** `AgnosticVRepo`, `AgnosticVComponent`
**CRDs written:** `CatalogItem`, `ResourceProvider`, `AnarchyGovernor`

---

### workshop-manager

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `workshop-manager/` |
| **Type** | Kopf (Python) |
| **Namespace** | `babylon-workshop-manager` |

**Purpose:** Core orchestration operator for multi-user workshops. Creates per-user `ResourceClaim`s from `WorkshopProvision`, manages user seat assignment/rotation, and orchestrates multi-workshop events.

**CRDs:** `Workshop`, `WorkshopProvision`, `WorkshopUserAssignment`, `MultiWorkshop`
**Also watches:** `ResourceClaim`, `ResourceProvider`, `CatalogItem`

---

### notifier

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `notifier/` |
| **Type** | Kopf (Python) + SMTP + Redis |
| **Namespace** | `babylon-notifier` |

**Purpose:** Sends transactional emails for provisioning/retirement/start/stop lifecycle events using Jinja2/MJML templates. Uses a dedicated Redis sidecar to deduplicate notifications across reconcile loops.

**CRDs watched:** `ResourceClaim`, `Workshop`
**Message templates stored in:** AgnosticV YAML (`__meta__.catalog.messageTemplates`)

---

### catalog-manager

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `catalog-manager/` |
| **Type** | Kopf (Python) |
| **Namespace** | `babylon-catalog-manager` |

**Purpose:** Periodically (every 30 min) enriches `CatalogItem`s with aggregate operational data: user ratings (from ratings API), `disabled` flag, and `lastSuccessfulProvision` timestamp.

**CRDs managed:** `CatalogItem`

---

### service-access-manager

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `service-access-manager/` |
| **Type** | Kopf (Python) |
| **Namespace** | `babylon-service-access-manager` |

**Purpose:** Manages RBAC granting users access to `ResourceClaim`/`Workshop` objects. Creates `ServiceAccess` records in each user's namespace. Reads `UserNamespace` CRs (from the external UserNamespace operator) to discover user-owned namespaces.

**CRDs:** `ServiceAccessConfig`, `ServiceAccess`
**Also watches:** `ResourceClaim`, `Workshop`, `WorkshopProvision`, `WorkshopUserAssignment`
**External CRDs read:** `UserNamespace` (`usernamespace.gpte.redhat.com`), `User` (`user.openshift.io`)

---

### lab-ui-manager

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `lab-ui-manager/` |
| **Type** | Kopf (Python) |
| **Namespace** | `babylon-lab-ui-manager` |

**Purpose:** Manages Bookbag lab-guide UI deployments for service instances. Watches `ResourceClaim`s for bookbag flags and manages the full build→deploy lifecycle: creates `BuildConfig`, `ImageStream`, `Deployment`, `Service`, and `Route` per claim.

**CRDs:** `BookbagBuild`, `BookbagDeployment`
**Also watches:** `ResourceClaim`

---

### cost-tracker

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `cost-tracker/` |
| **Type** | Kopf (Python) |
| **Namespace** | `babylon-cost-tracker` |

**Purpose:** Watches `ResourceClaim` events and annotates them with estimated AWS sandbox cost projections based on `provision_data` metadata.

**CRDs watched:** `ResourceClaim`

---

## Babylon-owned Services (stateless/DB-backed)

### Catalog Stack

The catalog is a set of stateless services deployed together under the `babylon-catalog` namespace:

| Sub-component | Type | Purpose |
|---|---|---|
| **Catalog UI** (`catalog/ui`) | React + PatternFly SPA | End-user portal: browse/order CatalogItems, manage services, workshops |
| **Catalog API** (`catalog/api`) | Python aiohttp | REST proxy between UI and OpenShift API; handles ordering, parameter validation, service listing, admin ops |
| **Catalog Status** (`catalog/status`) | nginx | Status/health page for catalog interfaces |
| **Catalog Redis** | Redis | Session cache for the catalog API |
| **OAuth Proxy** | OpenShift OAuth Proxy | Authentication gate in front of the catalog UI — SSO via OpenShift OAuth |

The Catalog API reads `CatalogItem`, `ResourceClaim`, and `Workshop` CRs directly via the OpenShift API — it is not a controller and owns no CRDs.

---

### Admin

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `admin/` |
| **Type** | FastAPI + Vue.js + DB |
| **Namespace** | `babylon-admin` |

**Purpose:** Admin UI and API for incident/support management and ServiceNow reporting. DB-backed (PostgreSQL/MySQL). Surfaces operational data and workshop forms for RHDP staff. No CRDs.

---

### Ratings

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `ratings/` |
| **Type** | FastAPI + DB |
| **Namespace** | `babylon-ratings` |

**Purpose:** Stores and serves user ratings for catalog items. Consumed by `catalog-manager` to enrich `CatalogItem` metadata. No CRDs.

---

## External Operator Dependencies

### Poolboy

| | |
|---|---|
| **Repo** | `redhat-cop/poolboy` (external) |
| **Type** | Go operator |
| **Namespace** | `poolboy` |
| **API group** | `poolboy.gpte.redhat.com` |

**Purpose:** Resource broker. Matches user `ResourceClaim`s to `ResourceHandle`s (either from a pre-allocated `ResourcePool` or dynamically). Creates `AnarchySubject` objects when a handle is bound to a claim.

**CRDs:** `ResourceProvider`, `ResourceClaim`, `ResourceHandle`, `ResourcePool`

---

### Anarchy

| | |
|---|---|
| **Repo** | `redhat-cop/anarchy` (external) |
| **Type** | Go operator |
| **Namespace** | `babylon-anarchy-*` (sharded) |
| **API group** | `anarchy.gpte.redhat.com` |

**Purpose:** Event-driven Ansible action runner. Watches `AnarchySubject` for desired-state changes and creates `AnarchyAction`s, fulfilled by `AnarchyRun` objects on Anarchy runner pods using governor Ansible roles.

**CRDs:** `AnarchyGovernor`, `AnarchySubject`, `AnarchyAction`, `AnarchyRun`

---

### UserNamespace Operator

| | |
|---|---|
| **Repo** | `rhpds/usernamespace` (external) |
| **Type** | Operator |
| **API group** | `usernamespace.gpte.redhat.com` |

**Purpose:** Provisions and manages a personal namespace for each OpenShift user. Each user gets a `UserNamespace` CR representing their sandbox namespace. `service-access-manager` reads these CRs to discover user-owned namespaces and grant the correct RBAC for `ResourceClaim`/`Workshop` access.

**CRDs:** `UserNamespace`

---

## Component Summary

| Component | Type | Owns CRDs | Namespace |
|---|---|---|---|
| agnosticv-operator | Kopf operator | AgnosticVRepo, AgnosticVComponent | babylon-config |
| workshop-manager | Kopf operator | Workshop, WorkshopProvision, WorkshopUserAssignment, MultiWorkshop | babylon-workshop-manager |
| notifier | Kopf + SMTP + Redis | — | babylon-notifier |
| catalog-manager | Kopf operator | — (enriches CatalogItem) | babylon-catalog-manager |
| service-access-manager | Kopf operator | ServiceAccess, ServiceAccessConfig | babylon-service-access-manager |
| lab-ui-manager | Kopf operator | BookbagBuild, BookbagDeployment | babylon-lab-ui-manager |
| cost-tracker | Kopf operator | — | babylon-cost-tracker |
| Catalog UI | React SPA | — | babylon-catalog |
| Catalog API | Python aiohttp | — | babylon-catalog |
| Catalog OAuth Proxy | OpenShift OAuth | — | babylon-catalog |
| Admin | FastAPI + Vue.js | — | babylon-admin |
| Ratings | FastAPI | — | babylon-ratings |
| Poolboy | Go operator (ext.) | ResourceProvider, ResourceClaim, ResourceHandle, ResourcePool | poolboy |
| Anarchy | Go operator (ext.) | AnarchyGovernor, AnarchySubject, AnarchyAction, AnarchyRun | babylon-anarchy-* |
| UserNamespace | Operator (ext.) | UserNamespace | — |
