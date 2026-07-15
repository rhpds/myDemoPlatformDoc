# Lifecycle Workflows

---

## A. Catalog Sync (AgnosticV → Babylon)

How catalog definitions flow from git into Kubernetes objects.

```
AgnosticV git commit / webhook / poll
         │
         ▼
  agnosticv-operator
         │  runs agnosticv CLI merge:
         │    account.yaml
         │    → common.yaml
         │    → dev.yaml / test.yaml / prod.yaml / event.yaml
         │    + #include snippets
         │
         ├─► AgnosticVComponent (one per path × stage)
         │
         ├─► CatalogItem         (UI metadata, parameters, access control)
         ├─► ResourceProvider    (Poolboy resource templates, lifespan)
         └─► AnarchyGovernor     (action definitions + Tower job vars)
```

**Steps:**

1. `AgnosticVRepo` CR configured with git URL, deploy key, poll interval or webhook endpoint.
2. Operator clones/fetches; runs `agnosticv` CLI merge of the full YAML hierarchy.
3. Creates/updates `AgnosticVComponent` per path×stage (e.g. `rhdp.dev-sandbox.prod`).
4. For each component, creates/updates:
   - **CatalogItem** in the catalog namespace
   - **ResourceProvider** in the Poolboy namespace
   - **AnarchyGovernor** in the assigned Anarchy namespace (sharded by load)
5. PR webhooks allow preview of components from feature branches with isolation locks.

---

## B. Ordering a Lab (Individual Service)

How a user order becomes a running environment.

```
User → Catalog UI → Catalog API
                        │ creates
                        ▼
                  ResourceClaim  (user namespace)
                        │
                        ▼
                     Poolboy
                        │ binds / creates
                        ▼
                  ResourceHandle ──► AnarchySubject
                                           │
                                           ▼
                                    Anarchy runner
                                           │ governor roles
                                           ▼
                                    AAP Tower job
                                           │ checkout AgnosticD @ scm_ref
                                           ▼
                                     ansible/main.yml
                                           │
                                           ▼
                                    provision_data
                                    ┌──────┴──────┐
                                    ▼             ▼
                             AnarchySubject   Notifier
                             → ResourceClaim  (email)
                             status
```

**Steps:**

1. User authenticates to Catalog UI via OAuth proxy.
2. Selects a `CatalogItem`, fills in parameters (Salesforce ID, purpose, `num_users`, etc.).
3. Catalog API creates `ResourceClaim` in the user's namespace with resource templates.
4. Poolboy matches the claim to a `ResourceProvider`, creates a `ResourceHandle`, creates `AnarchySubject`(s).
5. Anarchy detects the new subject and runs the governor `provision` action → AAP Tower job launched.
6. Tower checks out AgnosticD at `__meta__.deployer.scm_ref`; runs `ansible/main.yml` with `env_type` + job vars.
7. AgnosticD runs staged playbooks; writes `provision_data` (URLs, credentials, showroom info).
8. Governor updates `AnarchySubject` `current_state` → `started` and sets `provision_data`.
9. Poolboy reflects state on `ResourceClaim.status`.
10. Notifier sends provision-ready email using the CatalogItem message template.
11. Catalog UI shows the active service with live `provision_data` details.

---

## C. Workshop / MultiWorkshop

How instructor-led workshops are provisioned at scale.

```
Admin creates Workshop CR
         │
         ▼
Admin creates WorkshopProvision CR
  (count: 30, catalogItem: ..., concurrency: 5)
         │
         ▼
  workshop-manager
         │ creates N ResourceClaims
         │ (from ResourcePool if configured, else dynamically)
         │
         ├─► each ResourceClaim → Poolboy → AnarchySubject → Tower → AgnosticD
         │
         ▼
  WorkshopUserAssignment (per seat)
         │
         ▼
  Students use Workshop URL (no full catalog auth required)
```

**Notes:**
- `ResourcePool` enables pre-provisioned environments for instant student start-up.
- `MultiWorkshop` bundles multiple workshops under one event with shared schedule.
- Optional `accessPassword` gates the workshop portal.

---

## D. Lifecycle Management (Start / Stop / Destroy)

How running environments are controlled after provisioning.

| Trigger | Mechanism | AgnosticD entry |
|---------|-----------|-----------------|
| Manual stop in UI | `ResourceClaim` desired-state update | `lifecycle_entry_point.yml` (stop) |
| Scheduled stop | `ResourceProvider` lifespan timestamp | `lifecycle_entry_point.yml` (stop) |
| Manual start | `ResourceClaim` desired-state update | `lifecycle_entry_point.yml` (start) |
| Status check | Anarchy scheduled action | `lifecycle_entry_point.yml` (status) |
| Delete service | `ResourceClaim` deletion | `ansible/destroy.yml` |
| Retirement | Lifespan expiry (ResourceProvider) | `ansible/destroy.yml` |

**Flow:**

1. Desired-state change on `ResourceClaim` (or scheduled timestamp fires).
2. Poolboy propagates to `AnarchySubject.spec.desiredState`.
3. Anarchy creates `AnarchyAction` → governor runs correct lifecycle role.
4. Tower job calls `ansible/lifecycle_entry_point.yml` or `ansible/destroy.yml`.
5. Updated `provision_data` / state reflected on `AnarchySubject` → `ResourceClaim`.
6. Notifier sends retirement warning email (configurable days in advance), then deletion email.

---

## E. AgnosticD Config Execution

What happens inside a single Tower job run.

```
Tower job started
  env_type=ocp4-cluster  cloud_provider=ec2  guid=abc12
         │
         ▼
  ansible/configs/ocp4-cluster/
         │
         ├─ setup_runtime.yml        # install requirements, init vars
         ├─ pre_infra.yml            # pre-infra hooks
         ├─ aws_infrastructure_deployment.yml  # VPCs, EC2, security groups
         ├─ post_infra.yml           # post-infra hooks
         ├─ pre_software.yml         # pre-software hooks
         ├─ software.yml             # install OCP, workloads
         └─ post_software.yml        # completion callback, save output
                  │
                  ▼
         provision_data output
         (written to callback URL → AnarchySubject)
```

**Key variables set by governor before the job:**

| Variable | Source |
|----------|--------|
| `env_type` | AgnosticV `__meta__` / job_vars |
| `guid` | Generated by Poolboy (from ResourceHandle name) |
| `cloud_provider` | AgnosticV job_vars |
| `scm_ref` | AgnosticV `__meta__.deployer.scm_ref` (stage-pinned tag) |
| `workloads` | AgnosticV job_vars list |
| Cloud credentials | OCP Secret referenced in AnarchyGovernor `varSecrets` |

---

## F. Promotion Flow

How a catalog item moves from dev → test → prod.

```
1. Developer merges feature into AgnosticD and/or workload repos
2. agd-promote script:
     a. Creates a semver tag on AgnosticD (e.g. v4.28.3)
     b. Updates AgnosticV dev.yaml → test.yaml → prod.yaml
        with the new scm_ref tag
3. agnosticv-operator detects AgnosticV git commit
4. Reconciles AnarchyGovernor with updated job_vars.scm_ref
5. Next provision automatically uses the tagged AgnosticD version
```

Promotion is gated per stage — items can be in `dev` while still running `test` in parallel.
`event.yaml` overrides are used for one-off event deployments with frozen versions.
