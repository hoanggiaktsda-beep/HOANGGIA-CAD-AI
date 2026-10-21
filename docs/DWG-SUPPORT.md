# DWG-first requirement

## User workflow
Zalo -> Save to Files (iOS) -> Open in HOANGGIA CAD AI -> Measure / place furniture blocks -> Save a new version.

## Acceptance criteria
- File picker accepts .dwg and .dxf without requiring the user to rename or convert.
- Detect format from file signature and reject misleading extensions.
- For DWG, send to an explicitly configured conversion service or local agent; never claim that a static GitHub Pages frontend can decode DWG on its own.
- Preserve original DWG bytes, warn about unsupported entities, SHX fonts, Xrefs and layouts.
- Allow measurement only when drawing units and geometry are validated.
- Export a separate working copy; DWG output requires a compatible licensed conversion engine.
- Secure upload with user consent; no customer drawings committed to this public repository.

## Current status
Specification only. DWG import/render/export is not implemented. UI file selection alone does not count as DWG support.
