# Changelog

## v1.1.0 (2026-10)

- Every script runs inside its own function scope, so its variables no longer leak into After Effects' shared scripting engine or collide with other scripts.
- Undo groups are closed in a `finally` block: if a script fails halfway, the undo history stays clean.
- Each script carries its version in the first line.
- PuppetPin Null Creator no longer throws an error when no composition is active.
- Renamed `PupperPin_NullCreator.jsx` to `PuppetPin_NullCreator.jsx` and `2DPrameterToNull.jsx` to `2DParameterToNull.jsx`.

## v1.0.0 — 2026-09-23

- Initial public release: 17 tools (14 After Effects + 3 Illustrator) + 1 deprecated script.
- After Effects: Create Face Rig, Delete If No Children Or Matte, Dissolve Parent, Freeze Property, Marker Batch Render, Marker Copy-Paste, Move And Trim, Null Group, Project Folder Helper, PuppetPin Null Creator, Simple Parent, Simple Parent (Unparented Only), Sync Shy Layers, Trim To Keys.
- Illustrator: Renombrator, Sort Layers Left to Right, Sort Layers Reading Order.
- Deprecated: 2D Parameter to Null (After Effects includes this natively).
- Released under MIT + Commons Clause.
