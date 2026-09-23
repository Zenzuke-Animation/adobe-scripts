# Zenzuke — After Effects & Illustrator Scripts

Scripts for [Adobe After Effects](https://www.adobe.com/products/aftereffects.html) and [Adobe Illustrator](https://www.adobe.com/products/illustrator.html) by [Zenzuke](https://zenzuke.com).
Free to use — see [LICENSE](LICENSE) (MIT + Commons Clause: don't sell the software).

Web with docs in English and Spanish: https://zenzuke.com/scripts/

## Tools

### After Effects

| Tool | What it does | Download |
|---|---|---|
| **Create Face Rig** | Panel: creates two control nulls (Head_Control and Look_Control) and applies a parallax expression to the position of selected layers, driven by Look_Control. | [Script](../../releases/latest/download/CreateFaceRig.jsx) |
| **Delete If No Children Or Matte** | Safety filter for timeline cleanup: deletes selected layers only when they are not a parent of another layer and are not used as a track matte. | [Script](../../releases/latest/download/DeleteIfNoChildrenOrMatte.jsx) |
| **Dissolve Parent** | Removes a selected parent layer and transfers its children to the next hierarchy level, keeping their position in space. | [Script](../../releases/latest/download/DissolveParent.jsx) |
| **Freeze Property** | Locks animated properties by converting their current value into a fixed expression, rounded to two decimals. | [Script](../../releases/latest/download/FreezeProperty.jsx) |
| **Marker Batch Render** | Adds composition segments to the Render Queue based on markers, with output filenames taken from marker comments. | [Script](../../releases/latest/download/MarkerBatchRender.jsx) |
| **Marker Copy-Paste** | Panel: copy/paste composition and layer markers, batch-rename markers (search & replace) and sync comp markers down to precomps. | [Script](../../releases/latest/download/MarkerCopyPaste.jsx) |
| **Move And Trim** | Aligns selected layers in time with the layer just below: matches its start and trims the duration to end together. | [Script](../../releases/latest/download/MoveAndTrim.jsx) |
| **Null Group** | Creates a null at the average center of the selected (unparented) layers, spans its duration over them and parents them to it. | [Script](../../releases/latest/download/NullGroup.jsx) |
| **Project Folder Helper** | Exports the Project panel folder hierarchy to a .txt file and recreates it in any project. | [Script](../../releases/latest/download/ProjectFolderHelper.jsx) |
| **PuppetPin Null Creator** | Creates a null for each Puppet Pin, chains the nulls in hierarchy and drives the pins with expressions. | [Script](../../releases/latest/download/PupperPin_NullCreator.jsx) |
| **Simple Parent** | Parents all selected layers to the last layer in the selection. | [Script](../../releases/latest/download/SimpleParent.jsx) |
| **Simple Parent (Unparented Only)** | Same as Simple Parent, but skips layers that already have a parent, protecting existing hierarchies. | [Script](../../releases/latest/download/SimpleParent_Unparented.jsx) |
| **Sync Shy Layers** | Dockable panel: synchronizes the shy status of layers from a source composition to targets, matched by name. | [Script](../../releases/latest/download/SyncShyLayers.jsx) |
| **Trim To Keys** | Trims selected layers to run from their first to their last keyframe. | [Script](../../releases/latest/download/TrimToKeys.jsx) |

### Illustrator

| Tool | What it does | Download |
|---|---|---|
| **Renombrator (Illustrator)** | Renames all artboards of the active document in sequence, with prefix, starting number and zero padding. | [Script](../../releases/latest/download/Renombrator_AI.jsx) |
| **Sort Layers Left to Right** | Orders objects in the active layer from left to right (ties by Y) and updates their stacking order (z-order). | [Script](../../releases/latest/download/Sort_Layers_LeftToRight.jsx) |
| **Sort Layers Reading Order** | Orders objects of the active layer in reading order: top to bottom, right to left within each line of Y-proximate items. | [Script](../../releases/latest/download/Sort_Layers_ReadingOrder.jsx) |

### Deprecated

| Tool | What it does | Download |
|---|---|---|
| **2D Parameter to Null** | Creates a null for each 2D (x,y) property of selected effects and links it via expression. **Deprecated: After Effects includes this natively** (right-click the property → **Create Null from Path** style workflows / keyframe-linked nulls). | [Script](../../releases/latest/download/2DPrameterToNull.jsx) |

## Install

1. Download a script from the table above (or from [Releases](../../releases)).
2. Put it in the After Effects **Scripts** folder:
   - **After Effects**: `.../Adobe After Effects <version>/Scripts/` — run from **File > Scripts > [name]**.
   - **Illustrator**: `.../Adobe Illustrator <version>/Presets/<lang>/Scripts/` — run from **File > Scripts > [name]**.
   - Panels (Create Face Rig, Marker Copy-Paste, Sync Shy Layers) can also live in `Scripts/ScriptUI Panels/` so they dock as panels.
3. On macOS enable **Settings > Scripting & Expressions > Allow Scripts to Write Files and Access Network** if a script needs file access.

## Versioning

Each tool is versioned in [Releases](../../releases). `CHANGELOG.md` lists what changed.
