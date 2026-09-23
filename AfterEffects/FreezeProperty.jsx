(function freezeValueAutoDimension() {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        alert('No comp selected, or the active item is not a comp.');
        return;
    }
    
    var selectedProperties = comp.selectedProperties;
    if (selectedProperties.length === 0) {
        alert('No properties selected.');
        return;
    }
    
    var skippedProperties = 0;
    var processedProperties = 0;
    
    app.beginUndoGroup('Freeze Values Auto-Dimension');
    
    for (var i = 0; i < selectedProperties.length; i++) {
        var prop = selectedProperties[i];
        
        // Skip properties that can't have expressions without showing an alert
        if (!prop.canSetExpression) {
            skippedProperties++;
            continue;
        }
        
        var currentValue = prop.value;
        var freezeExpression = "";
        
        // Check if the property is multi-dimensional
        if (currentValue instanceof Array) {
            // Multi-dimensional, round each dimension separately
            var roundedValues = [];
            for (var j = 0; j < currentValue.length; j++) {
                roundedValues.push(parseFloat(currentValue[j].toFixed(2)));
            }
            freezeExpression = "value = [" + roundedValues.join(", ") + "];";
        } else {
            // Single dimension, round the value
            freezeExpression = "value = " + parseFloat(currentValue.toFixed(2)) + ";";
        }
        
        try {
            prop.expression = freezeExpression;
            processedProperties++;
        } catch (error) {
            skippedProperties++;
        }
    }
    
    app.endUndoGroup();
    
    // Show a summary instead of individual alerts
    if (processedProperties > 0) {
        var message = "Successfully froze " + processedProperties + " properties.";
        if (skippedProperties > 0) {
            message += "\nSkipped " + skippedProperties + " properties that couldn't have expressions.";
        }
        alert(message);
    } else if (skippedProperties > 0) {
        alert("No properties could be frozen. All " + skippedProperties + " selected properties cannot have expressions.");
    }
})();
