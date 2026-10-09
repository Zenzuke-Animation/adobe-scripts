// Simple Parent v1.1.0 | Zenzuke | https://zenzuke.com/scripts/
(function (thisObj) {
    function parentToLastSelected() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition.");
            return;
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length < 2) {
            alert("Please select at least two layers.");
            return;
        }

        var parentLayer = selectedLayers[selectedLayers.length - 1];
        app.beginUndoGroup("Parent Selected Layers");
        try {

            for (var i = 0; i < selectedLayers.length - 1; i++) {
                selectedLayers[i].parent = parentLayer;
            }

        } finally {
            app.endUndoGroup();
        }
    }

    parentToLastSelected();
})(this);