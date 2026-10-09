// Trim To Keys v1.1.0 | Zenzuke | https://zenzuke.com/scripts/
(function (thisObj) {
    {
        function trimLayerToKeyframes() {
            var comp = app.project.activeItem;
        
            if (!(comp instanceof CompItem)) {
                alert("Please select a composition.");
                return;
            }

            var selectedLayers = comp.selectedLayers;

            if (selectedLayers.length === 0) {
                alert("Please select at least one layer.");
                return;
            }

            app.beginUndoGroup("Trim Layer to Keyframes");
            try {

                for (var i = 0; i < selectedLayers.length; i++) {
                    var layer = selectedLayers[i];
                    var inPoint = null;
                    var outPoint = null;

                    function checkKeyframes(property) {
                        if (property.numProperties) {
                            for (var j = 1; j <= property.numProperties; j++) {
                                checkKeyframes(property.property(j));
                            }
                        } else if (property.numKeys > 0) {
                            var firstKeyTime = property.keyTime(1);
                            var lastKeyTime = property.keyTime(property.numKeys);

                            if (inPoint === null || firstKeyTime < inPoint) {
                                inPoint = firstKeyTime;
                            }

                            if (outPoint === null || lastKeyTime > outPoint) {
                                outPoint = lastKeyTime;
                            }
                        }
                    }

                    for (var p = 1; p <= layer.numProperties; p++) {
                        checkKeyframes(layer.property(p));
                    }

                    if (inPoint !== null && outPoint !== null) {
                        layer.inPoint = inPoint;
                        layer.outPoint = outPoint;
                    }
                }

            } finally {
                app.endUndoGroup();
            }
        }

        trimLayerToKeyframes();
    }
})(this);
