# Consulting Flow Runtime

This document explains how the consulting simulation is stitched together now that we rely on a mix of JSON and generated TypeScript for branching logic.

## Data Sources

| Source | Purpose |
| --- | --- |
| `career-data/consulting/flow.json` | Editable source of truth for the entire flow. Nodes can declare `choices`, `autoNext`, overlays, etc. |
| `config/static-consulting-flow.ts` | Generated snapshot (AZ1 → J1) that is bundled with the app so Netlify can run the overlay without reading from disk. Regenerate it from the JSON whenever those early nodes change. |

## API Fallback

`app/api/career-flow/[subject]/route.ts` tries to read `<repo>/career-data/<subject>/flow.json`, stripping any UTF-8 BOM before returning JSON. If the read fails (for example on Netlify), the consulting overlay loads `consultingFlowSegment` from the generated TypeScript file instead.

## Overlay Behaviour (`app/career-streams/page.tsx`)

1. **Stream selection** – Clicking consulting mounts `ConsultingFlowOverlay`.
2. **Data load** – Overlay requests `/api/career-flow/consulting`. On failure it falls back to `consultingFlowSegment`.
3. **Node rendering** – Videos use `VideoPlayer`; message/quiz nodes render inline UI. Nodes may include:
   - `choices`: rendered as buttons mapped to option keys A/B/C.
   - `autoNext`: if present and there are no choices, the overlay calls `navigateToNode(autoNext)` as soon as the video fires `video_completed`.
   - `overlays`: HTML or iframe content.
4. **Recording events** – Each video still records progress via `recordVideoProgressEvent`, storing both option key and label.
5. **Fallback** – If a referenced node is missing, the overlay drops back to the legacy consulting intro flow to avoid trapping the user in fullscreen.

## Regenerating the Static Segment

Run the helper script from the project root (adjust once you formalise it):

```powershell
pwsh -NoLogo -NoProfile -Command "
  Set-Location my-app;
  node ./scripts/generate-consulting-segment.js
"
```

_(For now the generation logic lives inline in the codebase updates; extract it into a reusable script when you extend the flow.)_

## Extending Beyond J1

1. Update `career-data/consulting/flow.json` with the new nodes.
2. Regenerate `config/static-consulting-flow.ts` so deployments without filesystem access stay in sync.
3. If you add new auto-advance nodes, include `"autoNext": "NextNodeId"` when `choices` is empty.

With these steps in place, both local development and Netlify deploys use the same branching logic, while still letting you iterate quickly on the JSON source of truth.
