# ae-scripts

Utility scripts for [Adobe After Effects](https://www.adobe.com/products/aftereffects.html) and [Adobe Illustrator](https://www.adobe.com/products/illustrator.html): rigging, timeline cleanup, markers, rendering, and layer ordering.

Documentation in English and Spanish: https://zenzuke.com/scripts/

## Install

1. Download a script from the tables below (or from the [Releases](../../releases) page).
2. Copy it to the host application's scripts folder:
   - **After Effects**: `.../Adobe After Effects <version>/Scripts/` — run it from **File > Scripts**. Dockable panels (Create Face Rig, Marker Copy-Paste, Sync Shy Layers) can also go into `Scripts/ScriptUI Panels/` so they appear in the Window menu.
   - **Illustrator**: `.../Adobe Illustrator <version>/Presets/<language>/Scripts/` — run it from **File > Scripts**.
3. On macOS, enable **Settings > Scripting & Expressions > Allow Scripts to Write Files and Access Network** if a script needs file access.

## Tools

### After Effects

| Tool | What it does | Download |
|---|---|---|
| Create Face Rig | Panel that creates two control nulls (Head_Control, Look_Control) and drives the position of selected layers with a parallax expression. | [CreateFaceRig.jsx](../../releases/latest/download/CreateFaceRig.jsx) |
| Delete If No Children Or Matte | Safety filter for timeline cleanup: deletes selected layers only when no other layer parents or track-mattes them. | [DeleteIfNoChildrenOrMatte.jsx](../../releases/latest/download/DeleteIfNoChildrenOrMatte.jsx) |
| Dissolve Parent | Removes a selected parent layer and transfers its children to the next level of the hierarchy, keeping their position in space. | [DissolveParent.jsx](../../releases/latest/download/DissolveParent.jsx) |
| Freeze Property | Locks animated properties by baking their current value into a fixed expression, rounded to two decimals. | [FreezeProperty.jsx](../../releases/latest/download/FreezeProperty.jsx) |
| Marker Batch Render | Adds comp segments to the Render Queue between composition markers, with output filenames taken from the marker comments. | [MarkerBatchRender.jsx](../../releases/latest/download/MarkerBatchRender.jsx) |
| Marker Copy-Paste | Panel to copy composition or layer markers onto other targets, batch-rename markers, and sync comp markers down to precomps. | [MarkerCopyPaste.jsx](../../releases/latest/download/MarkerCopyPaste.jsx) |
| Move And Trim | Aligns selected layers in time with the layer just below: matches its start and trims their duration to end together. | [MoveAndTrim.jsx](../../releases/latest/download/MoveAndTrim.jsx) |
| Null Group | Creates a null at the average center of the selected unparented layers, spans it over their duration and parents them to it. | [NullGroup.jsx](../../releases/latest/download/NullGroup.jsx) |
| Project Folder Helper | Exports the Project panel folder hierarchy to a .txt file and recreates the same structure in any project. | [ProjectFolderHelper.jsx](../../releases/latest/download/ProjectFolderHelper.jsx) |
| PuppetPin Null Creator | Creates a null for each Puppet Pin, chains the nulls in a hierarchy and drives the pins with expressions. | [PupperPin_NullCreator.jsx](../../releases/latest/download/PupperPin_NullCreator.jsx) |
| Simple Parent | Parents all selected layers to the last layer in the selection. | [SimpleParent.jsx](../../releases/latest/download/SimpleParent.jsx) |
| Simple Parent (Unparented Only) | Same, but skips layers that already have a parent so existing hierarchies are not broken. | [SimpleParent_Unparented.jsx](../../releases/latest/download/SimpleParent_Unparented.jsx) |
| Sync Shy Layers | Dockable panel that synchronizes the shy status of layers from a source composition to targets, matched by name. | [SyncShyLayers.jsx](../../releases/latest/download/SyncShyLayers.jsx) |
| Trim To Keys | Trims selected layers so their duration runs from their first to their last keyframe. | [TrimToKeys.jsx](../../releases/latest/download/TrimToKeys.jsx) |

### Illustrator

| Tool | What it does | Download |
|---|---|---|
| Renombrator (Illustrator) | Renames all artboards of the active document in sequence, with prefix, starting number and zero padding. | [Renombrator_AI.jsx](../../releases/latest/download/Renombrator_AI.jsx) |
| Sort Layers Left to Right | Orders objects of the active layer from left to right (ties broken top to bottom) and updates their stacking order. | [Sort_Layers_LeftToRight.jsx](../../releases/latest/download/Sort_Layers_LeftToRight.jsx) |
| Sort Layers Reading Order | Orders objects of the active layer in reading order: top to bottom, and within each line of Y-proximate items, right to left. | [Sort_Layers_ReadingOrder.jsx](../../releases/latest/download/Sort_Layers_ReadingOrder.jsx) |

### Deprecated

| Tool | What it does | Download |
|---|---|---|
| 2D Parameter to Null | Creates a null for each 2D (x,y) property of selected effects and links the property to it via expression. Deprecated: After Effects now includes equivalent functionality natively. | [2DPrameterToNull.jsx](../../releases/latest/download/2DPrameterToNull.jsx) |

## Versioning

Current release: [v1.0.0](../../releases). Each tool carries its own version; `CHANGELOG.md` lists what changed.

## License

MIT + Commons Clause — free to use, including commercial work, but do not sell the software. See [LICENSE](LICENSE).
