app.beginUndoGroup("Delete Layers without Children or Matte Links");

var targetComp = app.project.activeItem;

if (targetComp instanceof CompItem) {
    var selectedLayers = targetComp.selectedLayers;
    
    if (selectedLayers.length > 0) {
        var skippedLayers = [];

        // Iterate backwards through selection to avoid indexing issues after deletion
        for (var i = selectedLayers.length - 1; i >= 0; i--) {
            var currentLayer = selectedLayers[i];
            var hasChildren = false;
            var isUsedAsMatte = false;

            // 1. Check for Parent/Child relationships
            for (var j = 1; j <= targetComp.numLayers; j++) {
                if (targetComp.layer(j).parent === currentLayer) {
                    hasChildren = true;
                    break; 
                }
            }

            // 2. Check if this layer is used as a Track Matte by any other layer
            // This is necessary because the Matte source doesn't "know" it's a matte, 
            // only the layer receiving the matte knows.
            for (var k = 1; k <= targetComp.numLayers; k++) {
                var potentialOwner = targetComp.layer(k);
                // trackMatteLayer was introduced in AE 23.0. 
                // For older versions, we'd check .hasTrackMatte, but trackMatteLayer is the modern standard.
                if (potentialOwner.trackMatteLayer === currentLayer) {
                    isUsedAsMatte = true;
                    break;
                }
            }

            // Delete only if it fails both "protection" checks
            if (!hasChildren && !isUsedAsMatte) {
                currentLayer.remove();
            } else {
                var reason = hasChildren ? " (Parent)" : " (Matte Source)";
                skippedLayers.push("- " + currentLayer.name + reason);
            }
        }

        if (skippedLayers.length > 0) {
            alert("The following layers were NOT deleted because they are required:\n\n" + skippedLayers.reverse().join("\n"));
        }
    }
}

app.endUndoGroup();