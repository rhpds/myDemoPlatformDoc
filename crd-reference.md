# CRD Reference

All Custom Resource Definitions used by the Babylon platform, grouped by API group.

---

## `gpte.redhat.com` — AgnosticV operator CRDs

### AgnosticVRepo

Defines a git repository containing AgnosticV catalog YAML.

```yaml
apiVersion: gpte.redhat.com/v1
kind: AgnosticVRepo
spec:
  url: https://github.com/rhpds/agnosticv.git
  ref: master
  deployKey: <secret-ref>
  pollingInterval: 300
```

### AgnosticVComponent

One merged catalog item definition, produced by `agnosticv-operator` from a single path×stage.
Contains the fully merged `spec.definition` (all YAML layers collapsed) plus status conditions.

**Name pattern:** `<account>.<item-name>.<stage>` (e.g. `rhdp.dev-sandbox.prod`)

---

## `babylon.gpte.redhat.com` — Babylon CRDs

### CatalogItem

The catalog entry shown in the Catalog UI. Contains UI metadata, parameter schema, access control,
message templates, ratings, and a reference to the ResourceProvider.

Key fields:
- `spec.description` — AsciiDoc description shown to users
- `spec.parameters` — form fields rendered during ordering
- `spec.accessControl` — who can order (groups, sales roles)
- `spec.messageTemplates` — Jinja2 email templates (ready/failed/deleted/start/stop)
- `spec.resources[].provider` — reference to the ResourceProvider

### Workshop

Unauthenticated workshop portal with student seats.

```yaml
apiVersion: babylon.gpte.redhat.com/v1
kind: Workshop
spec:
  displayName: "My Workshop"
  description: "Workshop description"
  accessPassword: "<optional>"
  openRegistration: true
```

### WorkshopProvision

Scales N `ResourceClaim`s for a `Workshop` from a `CatalogItem`.

```yaml
apiVersion: babylon.gpte.redhat.com/v1
kind: WorkshopProvision
spec:
  workshopName: my-workshop
  catalogItem:
    name: rhdp.openshift-demo.prod
    namespace: babylon-catalog
  count: 30
  concurrency: 5
  startDelay: 30
```

### WorkshopUserAssignment

Maps a user email (or anonymous seat) to a provisioned workshop slot.

### MultiWorkshop

Bundles multiple workshops and shared assets under one event schedule with shared start/stop windows.

### ServiceAccess / ServiceAccessConfig

Access reporting and policy enforcement records for provisioned service instances.

---

## `poolboy.gpte.redhat.com` — Poolboy CRDs

### ResourceProvider

Defines the template(s) for a provisionable resource. Created by `agnosticv-operator`, one per catalog item.

Key fields:
- `spec.template.definition` — Jinja2 template for AnarchySubject spec
- `spec.parameters` — allowed/default values (merged from ResourceClaim)
- `spec.lifespan.default / maximum` — time-to-live for provisioned environments
- `spec.statusSummaryTemplate` — Jinja2 → ResourceClaim status summary

### ResourceClaim

The user's service instance / order. Created by the Catalog API in the user's namespace.

```yaml
apiVersion: poolboy.gpte.redhat.com/v1
kind: ResourceClaim
metadata:
  namespace: user-<username>
spec:
  resources:
    - provider:
        name: rhdp.openshift-demo.prod
        namespace: poolboy
      template:
        spec:
          vars:
            job_vars:
              num_users: 5
              salesforce_id: "T-1234"
```

**Status fields:**
- `status.resources[].state` — `provision-pending`, `started`, `provision-failed`, `stopped`, `deleted`
- `status.resources[].state.provision_data` — outputs from AgnosticD (URLs, passwords, showroom info)
- `status.summary` — rendered status message shown in UI

### ResourceHandle

Bound provisioned resource. Created by Poolboy when a claim is matched (from a pool or dynamically).
Contains the full merged resource spec and references the bound AnarchySubject.

### ResourcePool

Pre-allocated `ResourceHandle`s for fast provisioning. Poolboy continuously reconciles pool size.

```yaml
apiVersion: poolboy.gpte.redhat.com/v1
kind: ResourcePool
spec:
  minAvailable: 5
  resources:
    - provider:
        name: rhdp.openshift-demo.prod
        namespace: poolboy
```

---

## `anarchy.gpte.redhat.com` — Anarchy CRDs

### AnarchyGovernor

Per-catalog-item action definitions. Created by `agnosticv-operator`, one per catalog item.

Key fields:
- `spec.actions` — map of action name → Ansible role + vars (provision, start, stop, destroy, status)
- `spec.vars` — merged job variables from AgnosticV (env_type, cloud_provider, workloads, scm_ref, etc.)
- `spec.varSecrets` — references to OCP Secrets containing Tower credentials, cloud creds

### AnarchySubject

Service instance under a governor. Created by Poolboy when binding a ResourceHandle.

```yaml
apiVersion: anarchy.gpte.redhat.com/v1
kind: AnarchySubject
spec:
  governor: rhdp.openshift-demo.prod
  vars:
    job_vars:
      guid: abc12
      env_type: ocp4-cluster
      cloud_provider: ec2
status:
  current_state: started
  desired_state: started
  provision_data:
    bastion_public_hostname: bastion.abc12.example.com
    openshift_console_url: https://console.abc12.example.com
```

### AnarchyAction

Record of an action execution request. Created automatically by the Anarchy operator when
`AnarchySubject.spec.desiredState` changes or a scheduled action fires.

### AnarchyRun

Single Ansible role invocation record. One `AnarchyRun` is created per `AnarchyAction` execution.
Contains the runner pod assignment and result status.

---

## `babylon.gpte.redhat.com` — Lab UI CRDs

### BookbagBuild

Triggers an OpenShift build for a Bookbag lab UI image from a git repository.

### BookbagDeployment

Deploys a previously-built Bookbag image into the service namespace with the correct `provision_data` variables.

---

## `usernamespace.gpte.redhat.com` — UserNamespace operator (external)

### UserNamespace

Represents a personal OpenShift namespace provisioned for a specific user. Managed by the external **UserNamespace operator** (`rhpds/usernamespace`).

`service-access-manager` reads `UserNamespace` CRs to discover each user's personal namespace and create the appropriate `ServiceAccess` records and RBAC bindings granting access to `ResourceClaim` and `Workshop` objects.

```yaml
apiVersion: usernamespace.gpte.redhat.com/v1
kind: UserNamespace
metadata:
  name: user-djana
spec:
  user:
    name: djana
status:
  namespaceName: user-djana
```

---

## `user.openshift.io` — OpenShift built-in

### User

Standard OpenShift `User` object. Read (not managed) by `service-access-manager` to resolve user identity when granting RBAC for catalog resources.
