(function(thisObj) {
    // --- LOGIC FUNCTIONS ---

    // 1. Recursively get folder paths
    function getFolderPaths(folder, currentPath) {
        var paths = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof FolderItem && item.parentFolder === folder) {
                var fullPath = (currentPath === "") ? item.name : currentPath + "/" + item.name;
                paths.push(fullPath);
                // Recursively get subfolders
                paths = paths.concat(getFolderPaths(item, fullPath));
            }
        }
        return paths;
    }

    // 2. Create folders from a path string (e.g., "04_VIDEO/FOOTAGE")
    function createFolderFromPath(pathString) {
        var parts = pathString.split("/");
        var currentParent = app.project.rootFolder;

        for (var i = 0; i < parts.length; i++) {
            var folderName = parts[i];
            var found = false;

            // Check if folder already exists at this level
            for (var j = 1; j <= app.project.numItems; j++) {
                var item = app.project.item(j);
                if (item instanceof FolderItem && item.parentFolder === currentParent && item.name === folderName) {
                    currentParent = item;
                    found = true;
                    break;
                }
            }

            // If it doesn't exist, create it
            if (!found) {
                var newFolder = app.project.items.addFolder(folderName);
                newFolder.parentFolder = currentParent;
                currentParent = newFolder;
            }
        }
    }

    // --- UI DESIGN ---
    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "GYST Simple IO", undefined);
    win.orientation = "column";
    win.spacing = 10;
    win.margins = 15;

    var btnExport = win.add("button", undefined, "Export Structure (.txt)");
    var btnImport = win.add("button", undefined, "Import Structure (.txt)");

    // --- BUTTON ACTIONS ---

    btnExport.onClick = function() {
        var folderList = getFolderPaths(app.project.rootFolder, "");
        if (folderList.length === 0) return alert("No folders found to export!");

        var file = File.saveDialog("Save folder list", "Text files:*.txt");
        if (file) {
            file.open("w");
            file.write(folderList.join("\n")); // One folder path per line
            file.close();
            alert("Structure exported!");
        }
    };

    btnImport.onClick = function() {
        var file = File.openDialog("Select a folder list file", "Text files:*.txt");
        if (file) {
            file.open("r");
            app.beginUndoGroup("Import Folder Structure");
            
            while (!file.eof) {
                var line = file.readln();
                if (line !== "") {
                    createFolderFromPath(line);
                }
            }
            
            app.endUndoGroup();
            file.close();
            alert("Folders generated!");
        }
    };

    if (win instanceof Window) win.show();
})(this);