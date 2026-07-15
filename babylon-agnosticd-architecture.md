# Babylon + AgnosticD Architecture

## Overview

These three projects form the Red Hat Demo Platform (RHDP / demo.redhat.com) stack:

- **AgnosticV** — defines *what* can be ordered (catalog definitions as YAML in git)
- **Babylon** — orchestrates ordering and lifecycle on OpenShift (operators, UI, API)
- **AgnosticD** — actually provisions infrastructure and workloads (Ansible, runs via AAP/Tower)

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Git Repositories                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐ │
│  │  AgnosticV repo  │  │  AgnosticD repo  │  │ babylon_anarchy_       │ │
│  │  (YAML catalog)  │  │ (ansible/configs)│  │ governor (roles)       │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬─────────────┘ │
└───────────┼─────────────────────┼────────────────────────┼───────────────┘
            │ clone/poll          │ checkout at scm_ref    │ galaxy roles
            ▼                     │                        │
┌─────────────────────────────────────────────────────────────────────────┐
│  OpenShift / Babylon                                                     │
│                                                                          │
│  ┌────────────────┐    ┌──────────────┐    ┌─────────────────────────┐  │
│  │agnosticv-      │───►│ CatalogItem  │    │  Catalog UI + API       │  │
│  │operator        │───►│ Resource-    │    │  (babylon-api)          │  │
│  │                │───►│ Provider     │    └───────────┬─────────────┘  │
│  │                │    │ Anarchy-     │                │ user orders     │
│  └────────────────┘    │ Governor     │                ▼                │
│                        └──────────────┘    ┌─────────────────────────┐  │
│                                            │  ResourceClaim          │  │
│                         ┌──────────────┐   │  (user namespace)       │  │
│                         │   Poolboy    │◄──┘                         │  │
│                         │  (broker)    │                             │  │
│                         └──────┬───────┘                             │  │
│                                │ creates                             │  │
│                                ▼                                     │  │
│                        ┌──────────────┐    ┌─────────────────────┐   │  │
│                        │ResourceHandle│───►│  AnarchySubject     │   │  │
│                        └──────────────┘    └──────────┬──────────┘   │  │
│                                                        │              │  │
│                        ┌───────────────────────────────┘              │  │
│                        ▼                                               │  │
│                ┌───────────────┐                                       │  │
│                │ Anarchy Runner│                                       │  │
│                │ (governor     │                                       │  │
│                │  roles)       │                                       │  │
│                └───────┬───────┘                                       │  │
│  ┌─────────────────────┼───────────────────────────────────────────┐  │  │
│  │  provision_data ◄───┴──── AAP/Dark Tower ──► AgnosticD          │  │  │
│  │  (back to subject)          (Tower job)       ansible/main.yml  │  │  │
│  └─────────────────────────────────────────────────────────────────┘  │  │
│                                                                          │
│  Supporting operators: workshop-manager, notifier, catalog-manager,     │
│  service-access-manager, lab-ui-manager, cost-tracker                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Repositories

| Repository | Purpose |
|------------|---------|
| `redhat-cop/babylon` | Umbrella: catalog UI/API, all Babylon operators, Helm charts |
| `redhat-cop/agnosticd` | Ansible provisioner: 100+ configs under `ansible/configs/` |
| `rhpds/agnosticv` | Catalog definition YAML: accounts, stages, includes, message templates |
| `redhat-cop/poolboy` | Resource broker operator (external dependency) |
| `redhat-cop/anarchy` | Ansible action runner operator (external dependency) |
| `rhpds/babylon_anarchy_governor` | Ansible roles that bridge Anarchy → AAP jobs |
| `rhpds/sandbox` | Ephemeral cloud account / OCP sandbox allocation |

---

## Layer Summary

| Layer | System | Role |
|-------|--------|------|
| Catalog definition | AgnosticV (YAML) | Menu / recipe book |
| Order management | Babylon Catalog UI + API | Restaurant ordering system |
| Resource brokering | Poolboy | Table reservation / prep station |
| Action execution | Anarchy + governor | Kitchen workflow engine |
| Job runner | AAP / Dark Tower | Kitchen appliances |
| Provisioner | AgnosticD `ansible/configs/` | Recipes being executed |
| Cloud accounts | Sandbox API | Pre-allocated ingredients |

---

## Component Descriptions

### AgnosticV

Git-backed catalog definition repository. Contains hierarchical YAML + AsciiDoc that describes catalog items,
deployer variable pins, access control policies, and message templates.

- **Never executed directly** — consumed exclusively by `agnosticv-operator`
- **Stages**: `dev.yaml`, `test.yaml`, `prod.yaml`, `event.yaml` — environment-specific overrides
- **`#include`** directive for composable snippets (`includes/` directory)
- **Promotion tooling**: `scripts/agd-promote` tags AgnosticD repos and updates stage YAML with pinned `scm_ref`
- **Root `common.yaml`**: sets global defaults including the default deployer pointing to AgnosticD

Default deployer wiring (from root `common.yaml`):

```yaml
__meta__:
  deployer:
    type: agnosticd
    scm_type: git
    scm_url: https://github.com/redhat-cop/agnosticd.git
```

Stage YAML overrides `scm_ref` to pin a specific tag for prod/event stability.

### Babylon

OpenShift control plane for RHDP. Deployed via Helm (`helm/`) onto OpenShift. Provides:

- **Catalog UI** (`catalog/ui/`) — React + PatternFly SPA: browse/order CatalogItems, manage Services, Workshops
- **Catalog API** (`catalog/api/`) — Python Flask proxy between UI and OpenShift API; not a controller
- **agnosticv-operator** — syncs AgnosticV git → CatalogItem + ResourceProvider + AnarchyGovernor
- **workshop-manager** — Workshops, WorkshopProvisions, MultiWorkshops, seat assignment
- **notifier** — email on provision-ready/failed, start/stop, retirement, deletion
- **catalog-manager** — enriches CatalogItems with ratings and last-successful-provision data
- **service-access-manager** — ServiceAccess / ServiceAccessConfig CRs
- **lab-ui-manager** — deploys Bookbag lab UIs (BookbagBuild / BookbagDeployment)
- **cost-tracker** — estimates AWS sandbox costs on ResourceClaims

### AgnosticD

Ansible-based, cloud-agnostic provisioner. Each "config" is a directory under `ansible/configs/<env_type>/`.

**Entry points:**

| File | Action |
|------|--------|
| `ansible/main.yml` | Provision (`ACTION: provision`) |
| `ansible/destroy.yml` | Destroy |
| `ansible/lifecycle_entry_point.yml` | Start / stop / status |

**Staged execution inside a config:**

```
setup_runtime.yml
  → pre_infra.yml
    → <cloud>_infrastructure_deployment.yml
  → post_infra.yml
  → pre_software.yml
    → software.yml
  → post_software.yml
```

**Supported cloud providers:** AWS, Azure, GCP, OSP, IBM Cloud, Equinix, OpenShift CNV, VMware, `none` (workload-only)

### Poolboy (external — `redhat-cop/poolboy`)

Resource broker Go operator. Manages the resource lifecycle:

- **ResourceProvider** — defines allowed parameters, lifespan defaults, resource templates
- **ResourceClaim** — user order in their namespace; contains parameters + desired state
- **ResourceHandle** — bound provisioned resource (may come from a pre-allocated ResourcePool)
- **ResourcePool** — pre-provisioned handles for fast workshop scaling

When a ResourceHandle is bound, Poolboy creates `AnarchySubject` objects referencing the AnarchyGovernor.

### Anarchy (external — `redhat-cop/anarchy`)

Event-driven Ansible runner Go operator. Watches `AnarchySubject` state transitions and runs `AnarchyAction`s via `AnarchyRun` objects.

- **AnarchyGovernor** — per-catalog-item action definitions + variables + Tower secrets
- **AnarchySubject** — service instance; holds `current_state`, `desired_state`, `provision_data`
- **AnarchyAction** — an action execution request (provision/start/stop/destroy/status)
- **AnarchyRun** — a single Ansible role invocation record

### babylon_anarchy_governor

Ansible roles (not a K8s operator) that implement governor logic. Called by Anarchy runners. Responsible for:

- Constructing Tower/AAP job payloads from AnarchySubject vars
- Launching AAP jobs with the correct AgnosticD checkout ref
- Propagating `provision_data` back to the AnarchySubject after job completion

---

## CRD Relationship Chain

For a single lab order:

```
AgnosticV path/.../prod.yaml
  └─► AgnosticVComponent (e.g. rhdp.dev-sandbox.prod)
        ├─► CatalogItem            (catalog namespace — what the UI shows)
        ├─► ResourceProvider       (poolboy ns — defines resource templates)
        └─► AnarchyGovernor        (babylon-anarchy-N ns — action definitions)

User orders CatalogItem
  └─► ResourceClaim               (user namespace — the order)
        └─► ResourceHandle        (poolboy ns — bound resource)
              └─► AnarchySubject  (anarchy ns — service instance)
                    └─► AnarchyAction → Tower job → AgnosticD
                          └─► provision_data → AnarchySubject → ResourceClaim status
```

Linked components (multi-resource CatalogItems) use `linkedResourceProviders` and `propagate_provision_data`
so sandbox outputs (IPs, credentials) feed into workload provision vars.
