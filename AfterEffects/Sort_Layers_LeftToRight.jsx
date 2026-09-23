function execute() {
    // Select all the art items on the active layer
    var items = app.activeDocument.activeLayer.pageItems;
    var sortedItems = [];

    // Check if items are found
    if (items.length > 0) {
        alert('Found ' + items.length + ' items.');
    } else {
        alert('No items found.');
        return;
    }

    // Loop through to store all the items in an array
    for (var i = 0; i < items.length; i++) {
        sortedItems.push(items[i]);
    }

    // Sort the array based on x position (left to right), and if equal, sort by y position (top to bottom)
    sortedItems.sort(function(a, b) {
        var aX, bX, aY, bY;

        if (a.typename === "PathItem" && a.pathPoints.length == 2) {
            // If 'a' is a line
            aX = (a.pathPoints[0].anchor[0] + a.pathPoints[1].anchor[0]) / 2;
            aY = (a.pathPoints[0].anchor[1] + a.pathPoints[1].anchor[1]) / 2;
        } else {
            aX = a.left;
            aY = a.top;
        }

        if (b.typename === "PathItem" && b.pathPoints.length == 2) {
            // If 'b' is a line
            bX = (b.pathPoints[0].anchor[0] + b.pathPoints[1].anchor[0]) / 2;
            bY = (b.pathPoints[0].anchor[1] + b.pathPoints[1].anchor[1]) / 2;
        } else {
            bX = b.left;
            bY = b.top;
        }

        // First, sort by x position (left to right)
        if (aX !== bX) {
            return aX - bX;
        }
        
        // If x positions are equal, sort by y position (top to bottom)
        return bY - aY;  // Remember: higher `top` value means visually lower position
    });

    // Alert for sorting confirmation
    alert('Items sorted in array from left to right, then top to bottom. Rearranging in layer...');

    // Rearrange the items in the layer based on the sorted array
    for (i = 0; i < sortedItems.length; i++) {
        sortedItems[i].zOrder(ZOrderMethod.BRINGTOFRONT);
    }

    // Final alert
    alert('Items should be rearranged from left to right, and top to bottom where applicable.');
}

execute(); // Calling the function to run the script

