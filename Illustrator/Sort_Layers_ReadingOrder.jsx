function execute() {
    var epsilon = 50;  // Bumping up the epsilon for a safer range

    // Select all the art items on the active layer
    var items = app.activeDocument.activeLayer.pageItems;
    var sortedItems = [];

    // Check if items are found
    if (items.length > 0) {
      alert('Found ' + items.length + ' items.');
    } else {
      alert('No items found.');
      return; // This will now work correctly inside the function
    }

    // Loop through to store all the items in an array
    for (var i = 0; i < items.length; i++) {
      sortedItems.push(items[i]);
    }

	// Sort the array based on x, y positions
	sortedItems.sort(function(a, b) {
	  var aCenterX, aCenterY, bCenterX, bCenterY;

	  if (a.typename === "PathItem" && a.pathPoints.length == 2) {
		// If 'a' is a line
		aCenterX = (a.pathPoints[0].anchor[0] + a.pathPoints[1].anchor[0]) / 2;
		aCenterY = (a.pathPoints[0].anchor[1] + a.pathPoints[1].anchor[1]) / 2;
	  } else {
		aCenterX = a.left + (a.width / 2);
		aCenterY = a.top - (a.height / 2);
	  }

	  if (b.typename === "PathItem" && b.pathPoints.length == 2) {
		// If 'b' is a line
		bCenterX = (b.pathPoints[0].anchor[0] + b.pathPoints[1].anchor[0]) / 2;
		bCenterY = (b.pathPoints[0].anchor[1] + b.pathPoints[1].anchor[1]) / 2;
	  } else {
		bCenterX = b.left + (b.width / 2);
		bCenterY = b.top - (b.height / 2);
	  }

	  if (Math.abs(aCenterY - bCenterY) < epsilon) {
		return bCenterX - aCenterX;
	  }
	  return aCenterY - bCenterY;
	});

    // Alert for sorting confirmation
    alert('Items sorted in array. Rearranging in layer...');

    // Rearrange the items in the layer based on the sorted array
    for (i = 0; i < sortedItems.length; i++) {
      sortedItems[i].zOrder(ZOrderMethod.BRINGTOFRONT);  // Using BRINGTOFRONT instead
    }

    // Final alert
    alert('Items should be rearranged.');
}

execute(); // Calling the function to run the script
