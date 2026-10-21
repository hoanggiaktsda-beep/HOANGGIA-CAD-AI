# HOANGGIA CAD AI — Windows PC Agent Architecture

Status: design specification, not yet implemented.

## Assumptions
- User has an always-on Windows PC with Internet access.
- iPhone/MacBook access a mobile-first HTTPS web UI.
- Original DWG is preserved unchanged.

## Workflow
1. User chooses a DWG from iOS Files (including files saved from Zalo).
2. Web client uploads the file via authenticated HTTPS to a secure endpoint; no anonymous public uploads.
3. Job is queued for the Windows PC Agent; the PC initiates outbound authenticated communication, avoiding inbound router port forwarding.
4. Agent validates file type and runs a separately installed DWG-compatible converter (license and format support must be verified).
5. Agent returns a sanitized DXF/geometry representation, units, layers, block definitions, bounds, and warnings for unsupported entities/fonts/Xrefs.
6. Client renders geometry; measurement requires confirmed units and validated snapping.
7. User edits using an operation log (insert block, move, rotate, delete), with undo/redo.
8. Agent applies operations and saves a versioned DXF; DWG output requires verified conversion round-trip and explicit warnings.

## Security
- No customer drawings in GitHub repository or GitHub Pages assets.
- Per-device authentication, short-lived upload/download URLs, TLS, file size limits, malware/file validation, encryption at rest where feasible.
- Never expose Windows desktop or unauthenticated agent API to the Internet.
- Provide project deletion and retention settings.

## Modules
- web/: responsive editor (future)
- agent/: Windows worker service (future)
- cad-engine/: DXF parsing/editing/conversion adapter (future)
- docs/: architecture and acceptance criteria

## Milestones
M1: DXF viewer and geometry validation.
M2: measurement + block editing + versioned DXF export.
M3: Windows agent pairing and authenticated job queue.
M4: DWG import/export integration and AutoCAD round-trip tests.
M5: iPhone Safari and MacBook field tests, recovery/offline behavior.

## Open decisions
- Choose DWG conversion engine and confirm license.
- Choose hosted relay/job queue and operating costs.
- Define max file size, Xref packaging and supported DWG versions.
- Determine whether Windows PC should be accessible unattended and auto-start agent on boot.
