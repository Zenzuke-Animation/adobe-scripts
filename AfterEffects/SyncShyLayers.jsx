/**
 * Sync Shy Layers (Multi-Target with Progress)
 * 
 * A dockable panel to synchronize 'shy' layer status from one source composition
 * to any number of other selected target compositions with a progress bar.
 */
(function(thisObj) {
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Sync Shy Layers", undefined, {resizeable:true});
        
        // --- State ---
        var currentComps = [];
        var prevSourceId = null;

        // --- UI Layout ---
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 12;

        var header = win.add("statictext", undefined, "One-to-Many Sync");
        header.graphics.font = ScriptUI.newFont("Tahoma", "BOLD", 11);

        var mainGroup = win.add("group");
        mainGroup.orientation = "column";
        mainGroup.alignChildren = ["left", "center"];
        mainGroup.spacing = 5;

        // Source Row
        var srcGroup = mainGroup.add("group");
        srcGroup.add("statictext", undefined, "Source:");
        var srcDrop = srcGroup.add("dropdownlist", [0, 0, 180, 25]);

        // Target Info
        var tgtInfo = mainGroup.add("statictext", undefined, "Targets: 0 compositions");
        tgtInfo.preferredSize.width = 230;
        tgtInfo.graphics.font = ScriptUI.newFont("Tahoma", "ITALIC", 10);

        // Progress Bar
        var pBar = win.add("progressbar", undefined, 0, 100);
        pBar.preferredSize.height = 10;
        pBar.visible = false;

        // --- Helpers ---
        function updateTargetInfo() {
            if (currentComps.length < 2) {
                tgtInfo.text = "Select at least 2 comps and click Refresh.";
                return;
            }
            var count = currentComps.length - 1;
            tgtInfo.text = "Will sync to " + count + " target(s).";
            pBar.visible = false;
        }

        function refreshSelection() {
            var selection = app.project.selection;
            var comps = [];
            for (var i = 0; i < selection.length; i++) {
                if (selection[i] instanceof CompItem) {
                    comps.push(selection[i]);
                }
            }

            if (comps.length < 2) {
                alert("Please select at least 2 compositions in the Project panel.");
                return;
            }

            var newSourceIndex = 0;
            if (prevSourceId !== null) {
                for (var j = 0; j < comps.length; j++) {
                    if (comps[j].id === prevSourceId) {
                        newSourceIndex = j;
                        break;
                    }
                }
            }

            srcDrop.removeAll();
            for (var k = 0; k < comps.length; k++) {
                srcDrop.add("item", comps[k].name);
            }

            currentComps = comps;
            srcDrop.selection = newSourceIndex;
            updateTargetInfo();
        }

        srcDrop.onChange = updateTargetInfo;

        // --- Controls ---
        var refreshBtn = win.add("button", undefined, "Refresh Selection");
        refreshBtn.helpTip = "Load all currently selected compositions from the Project panel.";

        var syncBtn = win.add("button", undefined, "Sync to All Targets");
        syncBtn.alignment = "fill";
        syncBtn.graphics.font = ScriptUI.newFont("Tahoma", "BOLD", 12);

        // --- Event Listeners ---
        refreshBtn.onClick = refreshSelection;

        syncBtn.onClick = function() {
            if (!srcDrop.selection || currentComps.length < 2) {
                alert("Please load at least 2 compositions first.");
                return;
            }

            var sourceComp = currentComps[srcDrop.selection.index];
            prevSourceId = sourceComp.id;

            var targetComps = [];
            for (var i = 0; i < currentComps.length; i++) {
                if (i !== srcDrop.selection.index) {
                    targetComps.push(currentComps[i]);
                }
            }

            // Setup Progress Bar
            pBar.value = 0;
            pBar.maxvalue = targetComps.length;
            pBar.visible = true;
            win.layout.layout(true);

            app.beginUndoGroup("Sync Shy Layers to Multiple");
            
            var totalUpdated = 0;
            var sourceLayers = sourceComp.layers;
            var shyMap = {};

            for (var i = 1; i <= sourceLayers.length; i++) {
                var layer = sourceLayers[i];
                shyMap[layer.name] = layer.shy;
            }

            // Process with UI updates
            for (var t = 0; t < targetComps.length; t++) {
                var tComp = targetComps[t];
                var tLayers = tComp.layers;
                for (var j = 1; j <= tLayers.length; j++) {
                    var tLayer = tLayers[j];
                    if (shyMap.hasOwnProperty(tLayer.name)) {
                        if (tLayer.shy !== shyMap[tLayer.name]) {
                            tLayer.shy = shyMap[tLayer.name];
                            totalUpdated++;
                        }
                    }
                }
                
                // Update Progress
                pBar.value = t + 1;
                win.update(); 
            }

            app.endUndoGroup();
            
            alert("Sync Complete!\nUpdated " + totalUpdated + " layers across " + targetComps.length + " composition(s).");
            
            // Hide progress after a brief delay or immediately
            pBar.visible = false;
            win.layout.layout(true);
        };

        // --- Initialization ---
        var initialSelection = app.project.selection;
        var initialCompsCount = 0;
        for (var i = 0; i < initialSelection.length; i++) {
            if (initialSelection[i] instanceof CompItem) initialCompsCount++;
        }
        if (initialCompsCount >= 2) {
            refreshSelection();
        }

        win.onResizing = win.onResize = function() {
            this.layout.resize();
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
