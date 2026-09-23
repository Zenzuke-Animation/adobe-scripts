(function() {
    // Check if a composition is selected
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        alert("Please select a composition");
        return;
    }

    // Get selected properties
    var selectedProps = app.project.activeItem.selectedProperties;
    if (selectedProps.length === 0) {
        alert("Please select at least one effect property");
        return;
    }

    app.beginUndoGroup("Create Control Nulls for Selected Effect Points");

    // Process each selected property
    for (var i = 0; i < selectedProps.length; i++) {
        var prop = selectedProps[i];
        
        // Check if property is a point (checking both the property type and value length)
        if (prop.propertyValueType === 6415 || // Custom point property type
            (prop.value && prop.value.length === 2)) { // Has x,y coordinates
            
            try {
                // Get effect name
                var effect = prop;
                var effectName = "";
                while (effect.parentProperty) {
                    if (effect.matchName.indexOf("ADBE") === 0 && 
                        effect.propertyType === PropertyType.INDEXED_GROUP) {
                        effectName = effect.name;
                        break;
                    }
                    effect = effect.parentProperty;
                }
                
                // Create null name
                var nullName = "C_" + effectName + "_" + prop.name;
                
                // Create null object
                var nullLayer = comp.layers.addNull();
                nullLayer.name = nullName;
                
                // Get the point value
                var pointValue = prop.value;
                
                // Position null at the point value
                nullLayer.position.setValue(pointValue);
                
                // Set expression
                var expression = 'var l = null;\n' +
                               'try {l = thisComp.layer("' + nullName + '")} catch(e) {}\n' +
                               'var result = value;\n' +
                               'if (l != null) {\n' +
                               '    result = fromComp(l.toComp(l.anchorPoint));\n' +
                               '}\n' +
                               'result;';
                
                prop.expression = expression;
                
                // Set null duration
                nullLayer.startTime = comp.time;
                nullLayer.outPoint = comp.duration;
                
            } catch (err) {
                alert("Error processing property: " + err.toString() + 
                      "\nLine: " + err.line);
            }
        }
    }

    app.endUndoGroup();
})();

