(function(thisObj) {
    var scriptName = "Marker Copy-Paste";
    var storedMarkers = [];

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", scriptName, undefined, {resizeable: true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 16;

        var btnCopy = win.add("button", undefined, "Copy Markers");
        var btnPaste = win.add("button", undefined, "Paste Markers");
        var btnUpdate = win.add("button", undefined, "Update Markers from Source");
        
        var pnlRename = win.add("panel", undefined, "Batch Rename Markers");
        pnlRename.orientation = "column";
        pnlRename.alignChildren = ["fill", "top"];
        pnlRename.spacing = 10;
        
        var grpSearch = pnlRename.add("group");
        grpSearch.add("statictext", undefined, "Search:");
        var txtSearch = grpSearch.add("edittext", undefined, "portrait");
        txtSearch.preferredSize.width = 150;
        
        var grpReplace = pnlRename.add("group");
        grpReplace.add("statictext", undefined, "Replace:");
        var txtReplace = grpReplace.add("edittext", undefined, "landscape");
        txtReplace.preferredSize.width = 150;
        
        var grpRenameBtns = pnlRename.add("group");
        grpRenameBtns.alignment = ["center", "top"];
        var btnRenameComp = grpRenameBtns.add("button", undefined, "Rename Comp Markers");
        var btnRenameLayers = grpRenameBtns.add("button", undefined, "Rename Layer Markers");

        var lblStatus = win.add("statictext", undefined, "No markers copied.");
        lblStatus.alignment = ["center", "top"];

        function createMarkerValueFromSource(sourceVal) {
            var newVal = new MarkerValue(sourceVal.comment);
            newVal.duration = sourceVal.duration;
            newVal.chapter = sourceVal.chapter;
            newVal.url = sourceVal.url;
            newVal.frameTarget = sourceVal.frameTarget;
            newVal.cuePointName = sourceVal.cuePointName;
            newVal.eventCuePoint = sourceVal.eventCuePoint;
            
            if (parseFloat(app.version) >= 16.0) {
                if (sourceVal.hasOwnProperty("label")) newVal.label = sourceVal.label;
                if (sourceVal.hasOwnProperty("protectedRegion")) {
                    try { newVal.protectedRegion = sourceVal.protectedRegion; } catch(e) {}
                }
            }

            var params = sourceVal.getParameters();
            if (params) newVal.setParameters(params);
            
            return newVal;
        }

        btnCopy.onClick = function() {
            var activeItem = app.project.activeItem;
            if (!activeItem || !(activeItem instanceof CompItem)) {
                alert("Please select a composition.");
                return;
            }

            var sourceProperty = null;
            var sourceName = "";

            if (activeItem.selectedLayers.length > 0) {
                sourceProperty = activeItem.selectedLayers[0].property("Marker");
                sourceName = "Layer: " + activeItem.selectedLayers[0].name;
            } else {
                sourceProperty = activeItem.markerProperty;
                sourceName = "Comp: " + activeItem.name;
            }

            if (!sourceProperty || sourceProperty.numKeys === 0) {
                alert("No markers found on " + sourceName);
                return;
            }

            storedMarkers = [];
            for (var i = 1; i <= sourceProperty.numKeys; i++) {
                storedMarkers.push({
                    time: sourceProperty.keyTime(i),
                    value: sourceProperty.keyValue(i)
                });
            }

            lblStatus.text = storedMarkers.length + " markers copied from " + sourceName;
            win.layout.layout(true);
        };

        btnPaste.onClick = function() {
            if (storedMarkers.length === 0) {
                alert("No markers copied yet.");
                return;
            }

            var activeItem = app.project.activeItem;
            if (!activeItem || !(activeItem instanceof CompItem)) {
                alert("Please select a composition.");
                return;
            }

            var targets = [];
            if (activeItem.selectedLayers.length > 0) {
                for (var i = 0; i < activeItem.selectedLayers.length; i++) {
                    targets.push(activeItem.selectedLayers[i].property("Marker"));
                }
            } else {
                targets.push(activeItem.markerProperty);
            }

            if (targets.length === 0) return;

            var hasExisting = false;
            for (var t = 0; t < targets.length; t++) {
                if (targets[t].numKeys > 0) {
                    hasExisting = true;
                    break;
                }
            }

            var shouldReplace = false;
            if (hasExisting) {
                shouldReplace = confirm("Target(s) already contain markers. Do you want to REPLACE them?\n(Click 'No' to Append new markers to existing ones)");
            }

            app.beginUndoGroup("Paste Markers");

            for (var t = 0; t < targets.length; t++) {
                var targetProp = targets[t];
                if (shouldReplace) {
                    while (targetProp.numKeys > 0) targetProp.removeKey(1);
                }

                for (var m = 0; m < storedMarkers.length; m++) {
                    var mData = storedMarkers[m];
                    var newVal = createMarkerValueFromSource(mData.value);
                    targetProp.setValueAtTime(mData.time, newVal);
                }
            }

            app.endUndoGroup();
            alert("Pasted " + storedMarkers.length + " markers to " + targets.length + " target(s).");
        };

        btnUpdate.onClick = function() {
            var activeItem = app.project.activeItem;
            if (!activeItem || !(activeItem instanceof CompItem)) {
                alert("Please select a composition.");
                return;
            }

            var selectedLayers = activeItem.selectedLayers;
            var precompLayers = [];
            for (var i = 0; i < selectedLayers.length; i++) {
                if (selectedLayers[i].source && selectedLayers[i].source instanceof CompItem) {
                    precompLayers.push(selectedLayers[i]);
                }
            }

            if (precompLayers.length === 0) {
                alert("Please select at least one precomp layer.");
                return;
            }

            var hasExisting = false;
            for (var i = 0; i < precompLayers.length; i++) {
                if (precompLayers[i].property("Marker").numKeys > 0) {
                    hasExisting = true;
                    break;
                }
            }

            var shouldReplace = false;
            if (hasExisting) {
                shouldReplace = confirm("Target precomp(s) already contain markers. Do you want to REPLACE them?\n(Click 'No' to Append markers from source)");
            }

            app.beginUndoGroup("Update Markers from Source");

            var totalPasted = 0;
            for (var i = 0; i < precompLayers.length; i++) {
                var layer = precompLayers[i];
                var sourceComp = layer.source;
                var sourceMarkers = sourceComp.markerProperty;
                var targetProp = layer.property("Marker");

                if (shouldReplace) {
                    while (targetProp.numKeys > 0) targetProp.removeKey(1);
                }

                for (var m = 1; m <= sourceMarkers.numKeys; m++) {
                    var sourceTime = sourceMarkers.keyTime(m);
                    var sourceVal = sourceMarkers.keyValue(m);
                    var newVal = createMarkerValueFromSource(sourceVal);
                    
                    // Align to layer startTime
                    targetProp.setValueAtTime(sourceTime + layer.startTime, newVal);
                    totalPasted++;
                }
            }

            app.endUndoGroup();
            alert("Updated " + totalPasted + " markers across " + precompLayers.length + " precomp(s).");
        };

        function renameMarkersInProperty(prop, searchStr, replaceStr) {
            if (!prop || prop.numKeys === 0) return 0;
            var count = 0;
            for (var i = 1; i <= prop.numKeys; i++) {
                var val = prop.keyValue(i);
                if (val.comment.indexOf(searchStr) !== -1) {
                    var newComment = val.comment.split(searchStr).join(replaceStr);
                    var newVal = createMarkerValueFromSource(val);
                    newVal.comment = newComment;
                    prop.setValueAtTime(prop.keyTime(i), newVal);
                    count++;
                }
            }
            return count;
        }

        btnRenameComp.onClick = function() {
            var activeItem = app.project.activeItem;
            if (!activeItem || !(activeItem instanceof CompItem)) {
                alert("Please select a composition.");
                return;
            }
            var s = txtSearch.text;
            var r = txtReplace.text;
            if (s === "") {
                alert("Please enter a search string.");
                return;
            }
            
            app.beginUndoGroup("Rename Comp Markers");
            var renamed = renameMarkersInProperty(activeItem.markerProperty, s, r);
            app.endUndoGroup();
            alert("Renamed " + renamed + " markers on composition.");
        };

        btnRenameLayers.onClick = function() {
            var activeItem = app.project.activeItem;
            if (!activeItem || !(activeItem instanceof CompItem)) {
                alert("Please select a composition.");
                return;
            }
            var s = txtSearch.text;
            var r = txtReplace.text;
            if (s === "") {
                alert("Please enter a search string.");
                return;
            }
            
            app.beginUndoGroup("Rename Layer Markers");
            var totalRenamed = 0;
            for (var i = 1; i <= activeItem.numLayers; i++) {
                totalRenamed += renameMarkersInProperty(activeItem.layer(i).property("Marker"), s, r);
            }
            app.endUndoGroup();
            alert("Renamed " + totalRenamed + " markers across " + activeItem.numLayers + " layers.");
        };

        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }
    }

    buildUI(thisObj);
})(this);
