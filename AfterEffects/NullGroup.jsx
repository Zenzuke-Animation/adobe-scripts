var comp = app.project.activeItem;
if (comp && comp instanceof CompItem && comp.selectedLayers.length > 0) {
    app.beginUndoGroup("Create Centered Null");

    var layers = comp.selectedLayers;
    var totalPosition = [0, 0, 0];
    var earliestStart = comp.duration;  // Set to comp's duration as default
    var latestEnd = 0;  // Set to comp's start as default
    var count = 0;

    // Loop to calculate average position and determine earliest and latest in and out points
    for (var i = 0; i < layers.length; i++) {
        if (!layers[i].parent) {
            var layerPosition = layers[i].transform.position.value;
            totalPosition[0] += layerPosition[0];
            totalPosition[1] += layerPosition[1];
            if (layerPosition.length > 2) {  // for 3D layers
                totalPosition[2] += layerPosition[2];
            }
            earliestStart = Math.min(earliestStart, layers[i].inPoint);
            latestEnd = Math.max(latestEnd, layers[i].outPoint);
            count++;
        }
    }

    if (count === 0) {
        alert("No unparented layers selected.");
        app.endUndoGroup();
    } else {
        var averagePosition = [totalPosition[0]/count, totalPosition[1]/count, totalPosition[2]/count];

        // Add a Null layer without parameters
        var nullLayer = comp.layers.addNull();
		nullLayer.transform.anchorPoint.setValue([50,50]);
        nullLayer.transform.position.setValue(averagePosition);
        // Set inPoint and outPoint for the Null layer based on the selected layers
        nullLayer.inPoint = earliestStart;
        nullLayer.outPoint = latestEnd;

        // Parent the unparented selected layers to the Null layer
        for (var j = 0; j < layers.length; j++) {
            if (!layers[j].parent) {
                layers[j].parent = nullLayer;
            }
        }

        app.endUndoGroup();
    }
} else {
    alert("No layers selected or no active composition.");
}

