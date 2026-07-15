# Operators Reference

All operators below run on OpenShift. Babylon-owned operators are deployed via the Babylon Helm chart.
External operators (Poolboy, Anarchy) are maintained in separate repositories but deployed alongside Babylon.

---

## agnosticv-operator

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `agnosticv-operator/` |
| **Type** | Kopf (Python) |
| **Namespace** | `agnosticv-operator` |

**Purpose:** Syncs the AgnosticV git repository into Babylon Kubernetes objects. Polls or receives webhook
notifications, runs the `agnosticv` CLI to merge the YAML hierarchy for each path×stage, then creates/updates:

- `CatalogItem` — catalog UI metadata, parameters, access control, message templates
- `ResourceProvider` — Poolboy resource templates, lifespan defaults, status Jinja
- `AnarchyGovernor` — action definitions and Tower job variables

**CRDs owned:** `AgnosticVRepo`, `AgnosticVComponent`  
**CRDs written:** `CatalogItem`, `ResourceProvider`, `AnarchyGovernor`

---

## Poolboy

| | |
|---|---|
| **Repo** | `redhat-cop/poolboy` (external) |
| **Type** | Go operator |
| **API group** | `poolboy.gpte.redhat.com` |

**Purpose:** Resource broker. Matches user `ResourceClaim`s to `ResourceHandle`s (either from a pre-allocated
`ResourcePool` or dynamically). Creates `AnarchySubject` objects when a handle is bound to a claim.

**CRDs:** `ResourceProvider`, `ResourceClaim`, `ResourceHandle`, `ResourcePool`

---

## Anarchy

| | |
|---|---|
| **Repo** | `redhat-cop/anarchy` (external) |
| **Type** | Go operator |
| **API group** | `anarchy.gpte.redhat.com` |

**Purpose:** Event-driven Ansible action runner. Watches `AnarchySubject` for desired-state changes and
creates `AnarchyAction`s, which are fulfilled by `AnarchyRun` objects executed on Anarchy runner pods using
governor Ansible roles.

**CRDs:** `AnarchyGovernor`, `AnarchySubject`, `AnarchyAction`, `AnarchyRun`

---

## workshop-manager

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `workshop-manager/` |
| **Type** | Kopf (Python) |

**Purpose:** Manages workshop lifecycle. Creates and scales `ResourceClaim`s for workshop seats.
Assigns users to seats via `WorkshopUserAssignment`. Orchestrates multi-workshop events.

**CRDs:** `Workshop`, `WorkshopProvision`, `WorkshopUserAssignment`, `MultiWorkshop`

---

## notifier

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `notifier/` |
| **Type** | Kopf + SMTP |

**Purpose:** Sends transactional emails triggered by `ResourceClaim` state transitions. Templated messages for:
provision-ready, provision-failed, start, stop, retirement warning, deletion confirmation.

**CRDs watched:** `ResourceClaim`  
**Message templates stored in:** AgnosticV YAML (`__meta__.catalog.messageTemplates`)

---

## catalog-manager

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `catalog-manager/` |
| **Type** | Kopf (Python) |

**Purpose:** Enriches `CatalogItem`s with aggregate operational data: user ratings (from ratings DB),
`disabled` flag, `lastSuccessfulProvision` timestamp. Keeps catalog metadata fresh without touching AgnosticV.

**CRDs managed:** `CatalogItem`

---

## service-access-manager

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `service-access-manager/` |
| **Type** | Kopf (Python) |

**Purpose:** Reconciles `ServiceAccess` and `ServiceAccessConfig` CRs for access-control reporting
and policy enforcement on provisioned services.

**CRDs:** `ServiceAccess`, `ServiceAccessConfig`

---

## lab-ui-manager

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `lab-ui-manager/` |
| **Type** | Kopf (Python) |

**Purpose:** Watches `ResourceClaim`s for bookbag-UI requests and manages the full
build→deploy lifecycle of Bookbag lab UIs in the service namespace.

**CRDs:** `BookbagBuild`, `BookbagDeployment`

---

## cost-tracker

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `cost-tracker/` |
| **Type** | Kopf (Python) |

**Purpose:** Reads AWS sandbox metadata from `ResourceClaim` `provision_data` and annotates
claims with projected cost estimates. Read-only with respect to infra; writes only to claim annotations.

**CRDs watched:** `ResourceClaim`

---

## Catalog API (babylon-api)

| | |
|---|---|
| **Repo** | `redhat-cop/babylon` — `catalog/api/` |
| **Type** | Python Flask (not a Kubernetes controller) |

**Purpose:** REST proxy between the Catalog UI and the OpenShift API server. Handles OAuth, parameter
validation, `ResourceClaim` creation/update, service listing, admin operations, and Salesforce integration.
Speaks directly to the OpenShift API — no CRD ownership.
