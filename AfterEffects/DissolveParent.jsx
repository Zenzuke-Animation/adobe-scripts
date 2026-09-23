(function promoteChildrenAndDelete() {
    var comp = app.project.activeItem;

    // 1. Safety checks
    if (!(comp instanceof CompItem)) {
        alert("Please select a composition first.");
        return;
    }

    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length !== 1) {
        alert("Please select exactly one parent layer to clean up.");
        return;
    }

    var targetLayer = selectedLayers[0];
    var newParent = targetLayer.parent; // Could be a layer or 'null'

    app.beginUndoGroup("Promote Children and Delete Parent");

    // 2. Find all layers that call this layer 'Dad' or 'Mom'
    var children = [];
    for (var i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).parent === targetLayer) {
            children.push(comp.layer(i));
        }
    }

    // 3. Re-parent them
    // Note: AE handles the transformation math automatically when 
    // you set the .parent property via scripting.
    for (var j = 0; j < children.length; j++) {
        children[j].parent = newParent;
    }

    // 4. Delete the original selected layer
    targetLayer.remove();

    app.endUndoGroup();
})();