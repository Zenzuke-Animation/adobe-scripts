/**
 * Marker Batch Render
 * 
 * Takes composition markers and adds segments to the Render Queue.
 * Segments are defined from one marker to the next (or end of comp).
 * Output filenames are taken from the marker comments.
 */
(function markerBatchRenderUI(thisObj) {
    function buildUI(container) {
        var win = (container instanceof Panel) ? container : new Window("palette", "Marker Batch Render", undefined, {resizeable: true});
        
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 16;
        win.preferredSize.width = 400; // Set a reasonable starting width

        // --- Path Section ---
        var pathGroup = win.add("group");
        pathGroup.orientation = "row";
        pathGroup.alignment = ["fill", "top"];
        pathGroup.alignChildren = ["fill", "center"];
        
        pathGroup.add("statictext", undefined, "Path:");
        var pathEdit = pathGroup.add("edittext", undefined, "");
        // Setting alignment to "fill" on a child of a row group makes it take up remaining space
        pathEdit.alignment = ["fill", "center"];
        pathEdit.minimumSize.width = 250; 
        pathEdit.helpTip = "Paste the route where you want your renders to output.";
        
        var browseBtn = pathGroup.add("button", undefined, "Browse...");
        browseBtn.onClick = function() {
            var folder = Folder.selectDialog("Select output folder");
            if (folder) {
                pathEdit.text = folder.fsName;
            }
        };

        // --- Action Section ---
        var runBtn = win.add("button", undefined, "Add to Render Queue");
        runBtn.preferredSize.height = 40;
        runBtn.onClick = function() {
            executeRenderQueueAddition(pathEdit.text);
        };

        win.layout.layout(true);
        win.onResizing = win.onResize = function() {
            this.layout.resize();
        };
        return win;
    }

    function executeRenderQueueAddition(outputPath) {
        var comp = app.project.activeItem;

        if (!(comp instanceof CompItem)) {
            alert("Please select a composition first.");
            return;
        }

        var markerProp = comp.markerProperty;
        if (markerProp.numKeys === 0) {
            alert("No markers found in the composition.");
            return;
        }

        if (!outputPath) {
            alert("Please provide an output path.");
            return;
        }

        var outputFolder = new Folder(outputPath);
        if (!outputFolder.exists) {
            alert("The specified output folder does not exist.");
            return;
        }

        app.beginUndoGroup("Marker Batch Render");

        try {
            var renderQueue = app.project.renderQueue;
            var addedCount = 0;

            for (var i = 1; i <= markerProp.numKeys; i++) {
                var startTime = markerProp.keyTime(i);
                var endTime;

                if (i < markerProp.numKeys) {
                    endTime = markerProp.keyTime(i + 1);
                } else {
                    endTime = comp.duration;
                }

                var duration = endTime - startTime;
                if (duration <= 0) continue; 

                var markerVal = markerProp.keyValue(i);
                var fileName = markerVal.comment || ("Render_" + i);
                
                // Clean filename
                fileName = fileName.replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");

                // Add to Render Queue
                var renderItem = renderQueue.items.add(comp);
                renderItem.timeSpanStart = startTime;
                renderItem.timeSpanDuration = duration;

                var om = renderItem.outputModule(1);
                var outputFilePath = outputFolder.fsName + "/" + fileName;
                om.file = new File(outputFilePath);
                
                addedCount++;
            }

            alert("Added " + addedCount + " segments to the Render Queue.");
        } catch (err) {
            alert("Error adding to Render Queue: " + err.toString());
        } finally {
            app.endUndoGroup();
        }
    }

    var myPanel = buildUI(thisObj);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }
})(this);
