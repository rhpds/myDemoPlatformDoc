import {
  Stack, Row, Grid, H1, H2, H3, Text, Card, CardHeader, CardBody,
  Pill, Divider, Table, Callout, Code, Spacer, CollapsibleSection,
  computeDAGLayout, useHostTheme, useCanvasState,
} from "cursor/canvas";

// ─── Data ────────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Components", "CRDs", "Workflows", "Integration"] as const;
type Tab = typeof TABS[number];

const OPERATORS = [
  {
    name: "agnosticv-operator",
    repo: "babylon",
    type: "Kopf (Python)",
    purpose: "Clones/polls AgnosticV git repo; merges YAML hierarchy; creates & reconciles CatalogItem, ResourceProvider, and AnarchyGovernor CRs.",
    crds: ["AgnosticVRepo", "AgnosticVComponent", "CatalogItem", "ResourceProvider", "AnarchyGovernor"],
  },
  {
    name: "Poolboy",
    repo: "redhat-cop/poolboy (external)",
    type: "Go operator",
    purpose: "Resource broker: matches ResourceClaims to ResourceHandles (or ResourcePools for pre-provisioned envs). Creates AnarchySubjects when bound.",
    crds: ["ResourceProvider", "ResourceClaim", "ResourceHandle", "ResourcePool"],
  },
  {
    name: "Anarchy",
    repo: "redhat-cop/anarchy (external)",
    type: "Go operator",
    purpose: "Event-driven Ansible action runner. Watches AnarchySubjects for state changes and runs AnarchyActions (provision/start/stop/destroy/status) via AnarchyRuns.",
    crds: ["AnarchyGovernor", "AnarchySubject", "AnarchyAction", "AnarchyRun"],
  },
  {
    name: "workshop-manager",
    repo: "babylon",
    type: "Kopf (Python)",
    purpose: "Manages Workshops, WorkshopProvisions, and MultiWorkshops. Scales ResourceClaims for workshop seats and handles user-seat assignment.",
    crds: ["Workshop", "WorkshopProvision", "WorkshopUserAssignment", "MultiWorkshop"],
  },
  {
    name: "notifier",
    repo: "babylon",
    type: "Kopf + SMTP",
    purpose: "Watches ResourceClaims for state transitions and sends templated emails: provision-ready, provision-failed, start/stop, retirement warning, deletion.",
    crds: ["ResourceClaim (watch only)"],
  },
  {
    name: "catalog-manager",
    repo: "babylon",
    type: "Kopf (Python)",
    purpose: "Enriches CatalogItems with aggregate data: user ratings, disabled flags, last-successful-provision timestamps from the ratings DB.",
    crds: ["CatalogItem"],
  },
  {
    name: "service-access-manager",
    repo: "babylon",
    type: "Kopf (Python)",
    purpose: "Reconciles ServiceAccess and ServiceAccessConfig CRs for access-control reporting and policy enforcement on services.",
    crds: ["ServiceAccess", "ServiceAccessConfig"],
  },
  {
    name: "lab-ui-manager",
    repo: "babylon",
    type: "Kopf (Python)",
    purpose: "Deploys Bookbag lab UIs: watches ResourceClaims for bookbag flags and manages BookbagBuild / BookbagDeployment CRs.",
    crds: ["BookbagBuild", "BookbagDeployment"],
  },
  {
    name: "cost-tracker",
    repo: "babylon",
    type: "Kopf (Python)",
    purpose: "Estimates AWS sandbox costs by inspecting ResourceClaim provision_data and annotating claims with cost projections.",
    crds: ["ResourceClaim (watch only)"],
  },
  {
    name: "Catalog API (babylon-api)",
    repo: "babylon",
    type: "Python Flask (not a controller)",
    purpose: "REST/proxy API layer between Catalog UI and OpenShift API server. Handles auth, ordering, parameter validation, service listing, and admin operations.",
    crds: ["CatalogItem", "ResourceClaim (via API)"],
  },
];

const CRDS = [
  { name: "AgnosticVRepo", group: "gpte.redhat.com", owner: "agnosticv-operator", desc: "Defines a git repo containing AgnosticV YAML (URL, branch/tag, deploy key, poll interval)." },
  { name: "AgnosticVComponent", group: "gpte.redhat.com", owner: "agnosticv-operator", desc: "Merged catalog item definition for one path×stage combo. Source of truth for CatalogItem/ResourceProvider/AnarchyGovernor." },
  { name: "CatalogItem", group: "babylon.gpte.redhat.com", owner: "agnosticv-operator", desc: "What the Catalog UI shows: metadata, parameters, access control, message templates, rating." },
  { name: "ResourceProvider", group: "poolboy.gpte.redhat.com", owner: "Poolboy", desc: "Defines resource template(s), lifespan defaults, status Jinja, and default/allowed parameter values. One per catalog item." },
  { name: "ResourceClaim", group: "poolboy.gpte.redhat.com", owner: "Poolboy", desc: "User order / service instance. Lives in user namespace. Holds parameters, desired state, provision_data, and timestamps." },
  { name: "ResourceHandle", group: "poolboy.gpte.redhat.com", owner: "Poolboy", desc: "Bound provisioned resource. Created by Poolboy when a claim is matched (from pool or dynamically)." },
  { name: "ResourcePool", group: "poolboy.gpte.redhat.com", owner: "Poolboy", desc: "Pre-allocated handles for fast workshop provisioning. Poolboy maintains pool size." },
  { name: "AnarchyGovernor", group: "anarchy.gpte.redhat.com", owner: "Anarchy", desc: "Action definitions (provision/start/stop/destroy/status) + vars/secrets for a catalog item. One per item." },
  { name: "AnarchySubject", group: "anarchy.gpte.redhat.com", owner: "Anarchy", desc: "Instance of a service under a governor. Holds current_state, desired_state, and provision_data." },
  { name: "AnarchyAction", group: "anarchy.gpte.redhat.com", owner: "Anarchy", desc: "Record of an action execution request (provision, start, stop, etc.)." },
  { name: "AnarchyRun", group: "anarchy.gpte.redhat.com", owner: "Anarchy", desc: "Execution record for a single AnarchyAction run (Ansible role invocation)." },
  { name: "Workshop", group: "babylon.gpte.redhat.com", owner: "workshop-manager", desc: "Unauthenticated workshop portal. Holds title, description, access password, and seat count." },
  { name: "WorkshopProvision", group: "babylon.gpte.redhat.com", owner: "workshop-manager", desc: "Scales N ResourceClaims for a Workshop from a CatalogItem reference." },
  { name: "WorkshopUserAssignment", group: "babylon.gpte.redhat.com", owner: "workshop-manager", desc: "Maps user emails to workshop seats." },
  { name: "MultiWorkshop", group: "babylon.gpte.redhat.com", owner: "workshop-manager", desc: "Bundle of workshops and assets under one event schedule." },
  { name: "ServiceAccess", group: "babylon.gpte.redhat.com", owner: "service-access-manager", desc: "Access reporting record for a service instance." },
  { name: "BookbagBuild / BookbagDeployment", group: "babylon.gpte.redhat.com", owner: "lab-ui-manager", desc: "Build and deploy Bookbag lab UIs for services that request them." },
];

const WORKFLOWS = [
  {
    title: "A. Catalog Sync (AgnosticV → Babylon)",
    steps: [
      "AgnosticVRepo CR configured with git URL, deploy key, poll interval or webhook.",
      "agnosticv-operator clones/fetches; runs agnosticv CLI to merge YAML hierarchy: account.yaml → common.yaml → stage YAML + #includes.",
      "Creates/updates AgnosticVComponent per path×stage (e.g. rhdp.dev-sandbox.prod).",
      "For each component: creates/updates CatalogItem (UI metadata), ResourceProvider (lifespan, templates), and AnarchyGovernor (action definitions + job_vars).",
      "PR webhooks allow preview of components from PR branches with isolation locks.",
    ],
  },
  {
    title: "B. Ordering a Lab (Individual Service)",
    steps: [
      "User authenticates to Catalog UI via OAuth proxy.",
      "Selects a CatalogItem, fills parameters (Salesforce ID, purpose, num_users, etc.).",
      "Catalog API creates ResourceClaim with resource templates referencing the ResourceProvider.",
      "Poolboy matches/creates ResourceHandle, creates AnarchySubject(s) referencing the AnarchyGovernor.",
      "Anarchy runs governor 'provision' action → AAP/Tower job launched.",
      "Tower checks out AgnosticD at __meta__.deployer.scm_ref; runs ansible/main.yml with env_type + job_vars.",
      "AgnosticD runs staged playbooks; writes provision_data (URLs, credentials, showroom info).",
      "AnarchySubject state → 'started'; provision_data reflected on ResourceClaim status.",
      "Notifier sends 'provision-ready' email; Catalog UI shows live service.",
    ],
  },
  {
    title: "C. Workshop / MultiWorkshop",
    steps: [
      "Admin creates Workshop CR (title, description, optional password).",
      "WorkshopProvision CR references CatalogItem + count + concurrency; optionally references ResourcePool.",
      "workshop-manager creates N ResourceClaims to reach target count (from pool or dynamically).",
      "WorkshopUserAssignment assigns seats; students use workshop URL (no full catalog auth required).",
      "MultiWorkshop CR bundles multiple workshops and assets under one event.",
    ],
  },
  {
    title: "D. Lifecycle Management (Start / Stop / Destroy)",
    steps: [
      "ResourceClaim desired-state update (or scheduled timestamp) triggers Anarchy action.",
      "Governor schedules Tower job with AgnosticD entry: ansible/lifecycle_entry_point.yml (start/stop/status) or ansible/destroy.yml.",
      "Provision_data updated on AnarchySubject → Poolboy → ResourceClaim status.",
      "ResourceProvider defines lifespan/retirement windows; notifier sends retirement warning + deletion emails.",
    ],
  },
  {
    title: "E. AgnosticD Config Execution (Inside a Job)",
    steps: [
      "env_type selects configs/<env_type>/ directory in AgnosticD checkout.",
      "setup_runtime.yml: initialise env, install requirements.",
      "pre_infra.yml → cloud *_infrastructure_deployment.yml → post_infra.yml (VM/cluster creation).",
      "pre_software.yml → software.yml → post_software.yml (workload installation).",
      "Optional completion callback writes provision_data back to governor.",
    ],
  },
];

// ─── Architecture DAG ────────────────────────────────────────────────────────

const dagNodes = [
  { id: "agnosticv-git" },
  { id: "agnosticv-op" },
  { id: "catalogitem" },
  { id: "resourceprovider" },
  { id: "anarchygovernor" },
  { id: "catalog-ui" },
  { id: "resourceclaim" },
  { id: "poolboy" },
  { id: "resourcehandle" },
  { id: "anarchysubject" },
  { id: "anarchy" },
  { id: "aap" },
  { id: "agnosticd" },
  { id: "provision-data" },
  { id: "notifier" },
];

const dagEdges = [
  { from: "agnosticv-git", to: "agnosticv-op" },
  { from: "agnosticv-op", to: "catalogitem" },
  { from: "agnosticv-op", to: "resourceprovider" },
  { from: "agnosticv-op", to: "anarchygovernor" },
  { from: "catalog-ui", to: "resourceclaim" },
  { from: "catalogitem", to: "catalog-ui" },
  { from: "resourceclaim", to: "poolboy" },
  { from: "resourceprovider", to: "poolboy" },
  { from: "poolboy", to: "resourcehandle" },
  { from: "resourcehandle", to: "anarchysubject" },
  { from: "anarchygovernor", to: "anarchysubject" },
  { from: "anarchysubject", to: "anarchy" },
  { from: "anarchy", to: "aap" },
  { from: "aap", to: "agnosticd" },
  { from: "agnosticd", to: "provision-data" },
  { from: "provision-data", to: "anarchysubject" },
  { from: "provision-data", to: "notifier" },
];

const NODE_LABELS: Record<string, string> = {
  "agnosticv-git": "AgnosticV Repo",
  "agnosticv-op": "agnosticv-operator",
  "catalogitem": "CatalogItem",
  "resourceprovider": "ResourceProvider",
  "anarchygovernor": "AnarchyGovernor",
  "catalog-ui": "Catalog UI + API",
  "resourceclaim": "ResourceClaim",
  "poolboy": "Poolboy",
  "resourcehandle": "ResourceHandle",
  "anarchysubject": "AnarchySubject",
  "anarchy": "Anarchy Runner",
  "aap": "AAP / Dark Tower",
  "agnosticd": "AgnosticD\n(ansible/configs/)",
  "provision-data": "provision_data",
  "notifier": "Notifier (email)",
};

const NODE_GROUPS: Record<string, string> = {
  "agnosticv-git": "git",
  "agnosticv-op": "babylon",
  "catalogitem": "babylon",
  "resourceprovider": "poolboy",
  "anarchygovernor": "anarchy",
  "catalog-ui": "babylon",
  "resourceclaim": "poolboy",
  "poolboy": "poolboy",
  "resourcehandle": "poolboy",
  "anarchysubject": "anarchy",
  "anarchy": "anarchy",
  "aap": "aap",
  "agnosticd": "agnosticd",
  "provision-data": "data",
  "notifier": "babylon",
};

function ArchitectureDiagram() {
  const theme = useHostTheme();
  const NW = 148;
  const NH = 38;
  const layout = computeDAGLayout({
    nodes: dagNodes,
    edges: dagEdges,
    direction: "vertical",
    nodeWidth: NW,
    nodeHeight: NH,
    rankGap: 56,
    nodeGap: 24,
    padding: 24,
  });

  const groupColors: Record<string, string> = {
    git: theme.fill.secondary,
    babylon: theme.accent.primary,
    poolboy: theme.fill.primary,
    anarchy: theme.fill.secondary,
    aap: theme.fill.tertiary,
    agnosticd: theme.fill.tertiary,
    data: theme.fill.primary,
  };
  const groupText: Record<string, string> = {
    git: theme.text.secondary,
    babylon: theme.text.onAccent,
    poolboy: theme.text.secondary,
    anarchy: theme.text.secondary,
    aap: theme.text.tertiary,
    agnosticd: theme.text.tertiary,
    data: theme.text.secondary,
  };
  const groupBorder: Record<string, string> = {
    git: theme.stroke.secondary,
    babylon: theme.accent.primary,
    poolboy: theme.stroke.primary,
    anarchy: theme.stroke.secondary,
    aap: theme.stroke.tertiary,
    agnosticd: theme.stroke.tertiary,
    data: theme.stroke.primary,
  };

  const nodeMap = Object.fromEntries(layout.nodes.map((n) => [n.id, n]));

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={layout.width}
        height={layout.height}
        style={{ display: "block" }}
      >
        <defs>
          <marker
            id="arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={theme.stroke.primary} />
          </marker>
        </defs>

        {/* Edges */}
        {layout.edges.map((e, i) => {
          const midX = (e.sourceX + e.targetX) / 2;
          const midY = (e.sourceY + e.targetY) / 2;
          return (
            <g key={i}>
              <line
                x1={e.sourceX}
                y1={e.sourceY}
                x2={e.targetX}
                y2={e.targetY - 4}
                stroke={theme.stroke.secondary}
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
                strokeDasharray={e.isBackEdge ? "4 3" : undefined}
              />
            </g>
          );
        })}

        {/* Nodes */}
        {layout.nodes.map((n) => {
          const group = NODE_GROUPS[n.id] ?? "babylon";
          const label = NODE_LABELS[n.id] ?? n.id;
          const lines = label.split("\n");
          const bg = groupColors[group] ?? theme.fill.secondary;
          const fg = groupText[group] ?? theme.text.secondary;
          const border = groupBorder[group] ?? theme.stroke.secondary;
          return (
            <g key={n.id}>
              <rect
                x={n.x}
                y={n.y}
                width={NW}
                height={NH}
                rx={5}
                ry={5}
                fill={bg}
                stroke={border}
                strokeWidth={1.5}
              />
              {lines.map((line, li) => (
                <text
                  key={li}
                  x={n.x + NW / 2}
                  y={n.y + NH / 2 + (li - (lines.length - 1) / 2) * 14}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fontFamily="var(--font-mono, monospace)"
                  fill={fg}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function Legend() {
  const theme = useHostTheme();
  const items = [
    { color: theme.accent.primary, label: "Babylon (operators + UI)" },
    { color: theme.fill.primary, label: "Poolboy (resource broker)" },
    { color: theme.fill.secondary, label: "Anarchy / AgnosticV Git" },
    { color: theme.fill.tertiary, label: "AAP / AgnosticD" },
  ];
  return (
    <Row gap={20} wrap style={{ marginTop: 8 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: item.color,
              border: `1px solid ${theme.stroke.primary}`,
              flexShrink: 0,
            }}
          />
          <Text size="small" tone="secondary">{item.label}</Text>
        </div>
      ))}
    </Row>
  );
}

// ─── Components tab ──────────────────────────────────────────────────────────

function ComponentsTab() {
  const theme = useHostTheme();
  return (
    <Stack gap={24}>
      <Text tone="secondary">
        All Babylon operators run on OpenShift. External operators (Poolboy, Anarchy) are deployed
        alongside Babylon but maintained in separate repositories.
      </Text>
      {OPERATORS.map((op) => (
        <div key={op.name}>
          <Card collapsible defaultOpen>
            <CardHeader trailing={<Pill size="sm">{op.type}</Pill>}>{op.name}</CardHeader>
            <CardBody>
              <Stack gap={10}>
                <Text tone="secondary">{op.purpose}</Text>
                <Row gap={8} align="center" wrap>
                  <Text size="small" tone="tertiary" weight="semibold">Repo:</Text>
                  <Code>{op.repo}</Code>
                </Row>
                <Row gap={6} align="center" wrap>
                  <Text size="small" tone="tertiary" weight="semibold">CRDs:</Text>
                  {op.crds.map((c) => (
                    <div key={c} style={{ display: "inline-block" }}>
                      <Pill size="sm">{c}</Pill>
                    </div>
                  ))}
                </Row>
              </Stack>
            </CardBody>
          </Card>
        </div>
      ))}
    </Stack>
  );
}

// ─── CRDs tab ────────────────────────────────────────────────────────────────

function CRDsTab() {
  const groups = ["gpte.redhat.com", "poolboy.gpte.redhat.com", "anarchy.gpte.redhat.com", "babylon.gpte.redhat.com"];
  return (
    <Stack gap={28}>
      {groups.map((g) => {
        const crds = CRDS.filter((c) => c.group === g);
        return (
          <div key={g}>
            <Stack gap={10}>
              <H3>{g}</H3>
              <Table
                headers={["CRD", "Managed by", "Description"]}
                rows={crds.map((c) => [
                  <Code>{c.name}</Code>,
                  c.owner,
                  c.desc,
                ])}
                columnAlign={["left", "left", "left"]}
                striped
              />
            </Stack>
          </div>
        );
      })}
    </Stack>
  );
}

// ─── Workflows tab ───────────────────────────────────────────────────────────

function WorkflowsTab() {
  return (
    <Stack gap={20}>
      {WORKFLOWS.map((wf) => (
        <div key={wf.title}>
          <Card collapsible defaultOpen>
            <CardHeader>{wf.title}</CardHeader>
            <CardBody>
              <Stack gap={6}>
                {wf.steps.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Text tone="tertiary" size="small" weight="semibold" style={{ minWidth: 20, flexShrink: 0 }}>{i + 1}.</Text>
                    <Text tone="secondary">{step}</Text>
                  </div>
                ))}
              </Stack>
            </CardBody>
          </Card>
        </div>
      ))}
    </Stack>
  );
}

// ─── Integration tab ─────────────────────────────────────────────────────────

function IntegrationTab() {
  const theme = useHostTheme();
  const integrations = [
    {
      from: "AgnosticV",
      to: "Babylon",
      how: "agnosticv-operator clones AgnosticV repo and merges YAML hierarchy → CatalogItem + ResourceProvider + AnarchyGovernor",
    },
    {
      from: "AgnosticV",
      to: "AgnosticD",
      how: "__meta__.deployer (type: agnosticd, scm_url, scm_ref) + job_vars (env_type, cloud_provider, workloads) pinned in stage YAML",
    },
    {
      from: "Babylon",
      to: "AgnosticD",
      how: "Indirect: Anarchy governor → AAP Tower job template → checkout AgnosticD at scm_ref → run ansible/main.yml with extra vars from ResourceClaim",
    },
    {
      from: "Babylon",
      to: "Sandbox API",
      how: "__meta__.sandboxes config in AgnosticV; linked ResourceProviders for sandbox + workload; sandbox API allocates ephemeral AWS/OCP accounts",
    },
    {
      from: "AgnosticD",
      to: "Babylon",
      how: "Tower job callback sets provision_data + current_state on AnarchySubject → Poolboy reflects on ResourceClaim status → Catalog UI shows data",
    },
    {
      from: "Promotion tooling",
      to: "AgnosticD + AgnosticV",
      how: "agd-promote script: tags AgnosticD + workload repos, updates AgnosticV prod.yaml/event.yaml with pinned scm_ref",
    },
    {
      from: "Catalog API",
      to: "Ratings / Admin DBs",
      how: "catalog-manager enriches CatalogItems with aggregate ratings; admin API surfaces ServiceNow workshop forms and reporting data",
    },
  ];

  return (
    <Stack gap={24}>
      <Callout tone="info" title="Mental Model">
        AgnosticV is the menu (YAML recipe book). Babylon is the restaurant system (orders, seats, queue, emails).
        Poolboy is table reservation (claims and pools). Anarchy + governor is the kitchen workflow engine.
        AAP/Dark Tower is the kitchen appliances. AgnosticD is the recipe being executed. Sandbox provides
        the pre-allocated ingredients (ephemeral cloud accounts/clusters).
      </Callout>

      <H2>Integration Points</H2>
      <Table
        headers={["From", "To", "How"]}
        rows={integrations.map((row) => [
          <Text weight="semibold">{row.from}</Text>,
          <Text weight="semibold">{row.to}</Text>,
          row.how,
        ])}
        striped
      />

      <Divider />

      <H2>Default Deployer Wiring</H2>
      <Text tone="secondary">
        The root <Code>common.yaml</Code> in AgnosticV sets the default deployer for all catalog items:
      </Text>
      <Card>
        <CardHeader>AgnosticV root common.yaml — deployer defaults</CardHeader>
        <CardBody>
          <Stack gap={6}>
            <Text tone="secondary"><Code>__meta__.deployer.type: agnosticd</Code></Text>
            <Text tone="secondary"><Code>__meta__.deployer.scm_url: https://github.com/redhat-cop/agnosticd.git</Code></Text>
            <Text tone="secondary"><Code>__meta__.deployer.scm_type: git</Code></Text>
            <Text tone="secondary" size="small" italic>
              Stage YAML overrides scm_ref to pin a specific tag for prod/event stability.
            </Text>
          </Stack>
        </CardBody>
      </Card>

      <H2>Promotion Flow</H2>
      <Stack gap={6}>
        {[
          "Developer merges feature into AgnosticD + workload repos.",
          "agd-promote tags AgnosticD at a semver release tag.",
          "AgnosticV dev.yaml → test.yaml → prod.yaml stage files updated with the new scm_ref.",
          "agnosticv-operator detects AgnosticV commit → reconciles AnarchyGovernor with new job_vars (scm_ref).",
          "Next provision picks up the tagged AgnosticD version automatically.",
        ].map((step, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Text tone="tertiary" size="small" weight="semibold" style={{ minWidth: 20, flexShrink: 0 }}>{i + 1}.</Text>
            <Text tone="secondary">{step}</Text>
          </div>
        ))}
      </Stack>
    </Stack>
  );
}

// ─── Overview tab ────────────────────────────────────────────────────────────

function OverviewTab() {
  const theme = useHostTheme();
  const stats = [
    { label: "Babylon Operators", value: "8" },
    { label: "External Operators", value: "2" },
    { label: "CRD Groups", value: "4" },
    { label: "Total CRDs", value: "17+" },
    { label: "AgnosticD Configs", value: "100+" },
  ];
  return (
    <Stack gap={28}>
      <Grid columns={5} gap={16}>
        {stats.map((s) => (
          <div key={s.label}>
            <Card>
              <CardBody style={{ textAlign: "center", padding: "14px 8px" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: theme.accent.primary, lineHeight: 1.1 }}>
                  {s.value}
                </div>
                <Text size="small" tone="secondary">{s.label}</Text>
              </CardBody>
            </Card>
          </div>
        ))}
      </Grid>

      <Divider />

      <Grid columns={3} gap={20}>
        <Card>
          <CardHeader>AgnosticV</CardHeader>
          <CardBody>
            <Text tone="secondary">
              Git-backed catalog definition repository. Hierarchical YAML + AsciiDoc describing catalog items,
              deployer pins, access control, and message templates. Consumed by agnosticv-operator — never executed directly.
              Stages (dev/test/prod/event) and promotion tooling keep items aligned with tagged releases.
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Babylon</CardHeader>
          <CardBody>
            <Text tone="secondary">
              OpenShift control plane for RHDP (demo.redhat.com). Provides catalog UX, claim/pool orchestration
              (Poolboy), Ansible action engine (Anarchy + governor), workshop management, email notifications,
              ratings, Bookbag lab UIs, and cost tracking. Deployed via Helm onto OpenShift.
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>AgnosticD</CardHeader>
          <CardBody>
            <Text tone="secondary">
              Ansible-based, cloud-agnostic deployer. Contains 100+ configs under ansible/configs/ — each config
              is a staged playbook set (pre_infra → infra → post_infra → software). Triggered by Babylon via
              AAP/Tower jobs. Supports AWS, Azure, GCP, OSP, IBM, Equinix, OpenShift CNV, VMware, and more.
            </Text>
          </CardBody>
        </Card>
      </Grid>

      <H2>Architecture Diagram</H2>
      <Text tone="secondary" size="small">
        Top-to-bottom data flow: Git catalog definition → Babylon CRs → user order → resource binding → Ansible action → provisioning → state feedback.
      </Text>
      <ArchitectureDiagram />
      <Legend />

      <Divider />

      <H2>Layer Summary</H2>
      <Table
        headers={["Layer", "System", "Analogy"]}
        rows={[
          ["Catalog definition", "AgnosticV (YAML)", "Menu / recipe book"],
          ["Order management", "Babylon (Catalog UI + API)", "Restaurant ordering system"],
          ["Resource brokering", "Poolboy (CRDs)", "Table reservation / prep station"],
          ["Action execution", "Anarchy + babylon_anarchy_governor", "Kitchen workflow engine"],
          ["Job runner", "AAP / Dark Tower", "Kitchen appliances"],
          ["Provisioner", "AgnosticD (ansible/configs/)", "Recipes being executed"],
          ["Cloud accounts", "Sandbox API", "Pre-allocated ingredients"],
        ]}
        striped
      />
    </Stack>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function BabylonArchitecture() {
  const theme = useHostTheme();
  const [activeTab, setActiveTab] = useCanvasState<Tab>("tab", "Overview");

  return (
    <Stack gap={24} style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Stack gap={4}>
        <H1>Babylon + AgnosticD Architecture</H1>
        <Text tone="secondary">
          Red Hat Demo Platform (demo.redhat.com) — catalog, provisioning orchestration, and environment lifecycle.
        </Text>
      </Stack>

      <Row gap={8} wrap>
        {TABS.map((tab) => (
          <div key={tab}>
            <Pill active={activeTab === tab} onClick={() => setActiveTab(tab)}>
              {tab}
            </Pill>
          </div>
        ))}
      </Row>

      <Divider />

      {activeTab === "Overview" && <OverviewTab />}
      {activeTab === "Components" && <ComponentsTab />}
      {activeTab === "CRDs" && <CRDsTab />}
      {activeTab === "Workflows" && <WorkflowsTab />}
      {activeTab === "Integration" && <IntegrationTab />}
    </Stack>
  );
}
