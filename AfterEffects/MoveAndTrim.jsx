app.beginUndoGroup("Move and Trim Layer");

var comp = app.project.activeItem;
if (!comp || !(comp instanceof CompItem)) {
    alert("Please select a composition.");
} else {
    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length == 0) {
        alert("Please select at least one layer.");
    } else {
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var layerIndex = layer.index;
            if (layerIndex < comp.numLayers) {
                var belowLayer = comp.layer(layerIndex + 1);
                var timeDiff = belowLayer.inPoint - layer.inPoint;
                
                layer.startTime += timeDiff;
                layer.outPoint = belowLayer.outPoint;
            }
        }
    }
}

app.endUndoGroup();