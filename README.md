# Red Hat Demo Platform — Architecture Documentation

Architecture documentation for the Red Hat Demo Platform (RHDP / demo.redhat.com), covering Babylon, AgnosticD, AgnosticV, and all related Kubernetes operators.

---

## Interactive Architecture View

> **Full tabbed interactive view** — open [`archHtmlFormat/index.html`](archHtmlFormat/index.html) directly, or use the iframes below.
>
> **Note:** GitHub.com strips `<iframe>` tags from rendered markdown for security. To see the embedded views below, either:
> - Enable **GitHub Pages** on this repo (Settings → Pages → branch: `main`) — then view at `https://rhpds.github.io/myDemoPlatformDoc/`
> - Clone the repo and open `README.md` in VS Code / a local browser
> - Open any tab file directly: [Overview](archHtmlFormat/index.html) · [Components](archHtmlFormat/components.html) · [CRDs](archHtmlFormat/crds.html) · [Workflows](archHtmlFormat/workflows.html) · [Integration](archHtmlFormat/integration.html)

### Overview

<iframe src="archHtmlFormat/index.html" width="100%" height="620" frameborder="0" style="border:1px solid #333;border-radius:6px;background:#1e1e1e"></iframe>

### Components

<iframe src="archHtmlFormat/components.html" width="100%" height="620" frameborder="0" style="border:1px solid #333;border-radius:6px;background:#1e1e1e"></iframe>

### CRDs

<iframe src="archHtmlFormat/crds.html" width="100%" height="620" frameborder="0" style="border:1px solid #333;border-radius:6px;background:#1e1e1e"></iframe>

### Workflows

<iframe src="archHtmlFormat/workflows.html" width="100%" height="620" frameborder="0" style="border:1px solid #333;border-radius:6px;background:#1e1e1e"></iframe>

### Integration

<iframe src="archHtmlFormat/integration.html" width="100%" height="620" frameborder="0" style="border:1px solid #333;border-radius:6px;background:#1e1e1e"></iframe>

---

## Architecture Overview (GitHub native — always visible)

```mermaid
flowchart TD
    AV["AgnosticV Repo\n(YAML catalog defs)"]
    AVO["agnosticv-operator"]
    CI["CatalogItem"]
    RP["ResourceProvider"]
    AG["AnarchyGovernor"]
    UI["Catalog UI + API"]
    RC["ResourceClaim\n(user order)"]
    PB["Poolboy\n(resource broker)"]
    RH["ResourceHandle"]
    AS["AnarchySubject"]
    AN["Anarchy Runner\n(governor roles)"]
    AAP["AAP / Dark Tower\n(Tower job)"]
    AD["AgnosticD\nansible/configs/"]
    PD["provision_data\n(URLs, creds)"]
    NT["Notifier\n(email)"]
    WM["workshop-manager"]

    AV -->|clone / poll| AVO
    AVO --> CI & RP & AG
    CI -->|browse / order| UI
    UI -->|creates| RC
    RC & RP --> PB
    PB -->|binds| RH
    RH -->|creates| AS
    AG -->|defines actions| AS
    AS --> AN
    AN -->|launches job| AAP
    AAP -->|checkout + run| AD
    AD -->|writes| PD
    PD -->|updates state| AS
    AS -->|reflects on| RC
    PD --> NT
    WM -->|scales claims| RC

    style AV fill:#3d3d3d,color:#ddd,stroke:#666
    style AVO fill:#003d73,color:#fff,stroke:#0066cc
    style CI fill:#003d73,color:#fff,stroke:#0066cc
    style UI fill:#003d73,color:#fff,stroke:#0066cc
    style NT fill:#003d73,color:#fff,stroke:#0066cc
    style WM fill:#003d73,color:#fff,stroke:#0066cc
    style RP fill:#1a3a1a,color:#fff,stroke:#33aa33
    style RC fill:#1a3a1a,color:#fff,stroke:#33aa33
    style PB fill:#1a3a1a,color:#fff,stroke:#33aa33
    style RH fill:#1a3a1a,color:#fff,stroke:#33aa33
    style AG fill:#3a2a00,color:#fff,stroke:#cc8800
    style AS fill:#3a2a00,color:#fff,stroke:#cc8800
    style AN fill:#3a2a00,color:#fff,stroke:#cc8800
    style AAP fill:#2a1a3a,color:#fff,stroke:#9933cc
    style AD fill:#2a1a3a,color:#fff,stroke:#9933cc
    style PD fill:#3a1a1a,color:#fff,stroke:#cc3333
```

| Color | Layer | Systems |
|-------|-------|---------|
| Blue | Babylon | agnosticv-operator, Catalog UI + API, notifier, workshop-manager |
| Green | Poolboy (resource broker) | ResourceProvider, ResourceClaim, ResourceHandle, Poolboy |
| Orange | Anarchy (action engine) | AnarchyGovernor, AnarchySubject, Anarchy Runner |
| Purple | Execution | AAP / Dark Tower, AgnosticD |
| Red | Data feedback | provision_data |

---

## Contents

| File | Description |
|------|-------------|
| [archHtmlFormat/index.html](archHtmlFormat/index.html) | **Full tabbed interactive HTML** — all 5 sections in one page |
| [archHtmlFormat/overview.html](archHtmlFormat/overview.html) | Overview tab direct link |
| [archHtmlFormat/components.html](archHtmlFormat/components.html) | Components tab direct link |
| [archHtmlFormat/crds.html](archHtmlFormat/crds.html) | CRDs tab direct link |
| [archHtmlFormat/workflows.html](archHtmlFormat/workflows.html) | Workflows tab direct link |
| [archHtmlFormat/integration.html](archHtmlFormat/integration.html) | Integration tab direct link |
| [babylon-agnosticd-architecture.md](babylon-agnosticd-architecture.md) | Full architecture reference (markdown) |
| [operators-reference.md](operators-reference.md) | Per-operator reference card |
| [crd-reference.md](crd-reference.md) | All CRDs grouped by API group |
| [workflows.md](workflows.md) | Step-by-step lifecycle workflows |
| [babylon-agnosticd-architecture.canvas.tsx](babylon-agnosticd-architecture.canvas.tsx) | Interactive visual canvas (tabbed architecture view) |

---

## Quick mental model

| Layer | System | Analogy |
|-------|--------|---------|
| Catalog definition | AgnosticV (YAML) | Menu / recipe book |
| Order management | Babylon (Catalog UI + API) | Restaurant ordering system |
| Resource brokering | Poolboy (CRDs) | Table reservation / prep station |
| Action execution | Anarchy + babylon_anarchy_governor | Kitchen workflow engine |
| Job runner | AAP / Dark Tower | Kitchen appliances |
| Provisioner | AgnosticD (ansible/configs/) | Recipes being executed |
| Cloud accounts | Sandbox API | Pre-allocated ingredients |


## Knowledge Transfer Meeting Recording:
<iframe width="560" height="315" 
        src="[Babylon - OpenShift orchestration that powers RHDP - 2026/06/04 21:00 IST - Recording](https://drive.google.com/file/d/1rivmVOdPl3YyWMmxirVHEzX-dvQkjIiA/view)" 
        title="YouTube video player" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
        allowfullscreen>
</iframe>
<iframe width="560" height="315" 
        src="[Babylon API and UI - 2026/06/24 20:04 IST - Recording](https://drive.google.com/file/d/1Spqdp8cgLvSUt1wFaAgiu-t2P0mxyteI/view)" 
        title="YouTube video player" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
        allowfullscreen>
</iframe>
<iframe width="560" height="315" 
        src="[Babylon ArgoCD configuration and maintenance  - 2026/07/14 19:59 IST - Recording](https://drive.google.com/file/d/18HoaROQp1RdO-JVaQd1dLOb0zydqm5Tm/view)" 
        title="YouTube video player" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
        allowfullscreen>
</iframe>
