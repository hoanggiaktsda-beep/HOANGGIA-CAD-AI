# HOANGGIA CAD AI · Roadmap

## Scope
Mobile-first CAD site workspace for interior architects. Keep original client files intact.

## Stage 0 (current)
- Independent Vite + TypeScript shell
- Responsive canvas and basic pan / wheel zoom
- Local file selection; **no DXF/DWG parser yet**
- No file upload, persistence, or remote services

## Stage 1
- Parse DXF model space with entity coverage report
- CAD units, layer visibility, extents, zoom-to-fit
- Touch pinch zoom and reliable selection

## Stage 2
- Coordinate-based endpoint/midpoint/intersection snap and measurement
- Insert DXF furniture blocks, move/rotate/copy/delete, undo/redo
- Round-trip DXF export and comparison with AutoCAD

## Stage 3
- DWG conversion via separately deployed licensed/approved engine
- SHX/Xref/proxy handling, conversion warnings
- Offline project persistence, security review and regression tests

## Non-goals for foundation
- No claim of native DWG support
- No claim of production-safe measurements or CAD exports
- No storage of customer drawings in public repository
