{
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Face Rig Creator", undefined);
        win.orientation = "column";
        win.alignChildren = ["center", "top"];

        var createControlBtn = win.add("button", undefined, "Create Control Nulls");
        var multiplierSlider = win.add("slider", undefined, 0.5, 0, 1);
        var multiplierEditText = win.add("edittext", undefined, "0.5");
        multiplierSlider.onChanging = function () {
            multiplierEditText.text = multiplierSlider.value.toFixed(2);
        };
        multiplierEditText.onChange = function () {
            multiplierSlider.value = parseFloat(multiplierEditText.text);
        };
        var applyBtn = win.add("button", undefined, "Apply to Selected Layers");

        createControlBtn.onClick = function () {
            createControlNulls();
        };
        applyBtn.onClick = function () {
            applyParallax(multiplierSlider.value);
        };

        function createControlNulls() {
            var comp = app.project.activeItem;
            if (!(comp && comp instanceof CompItem)) {
                alert("Please select a composition.");
                return;
            }

            var selectedLayers = comp.selectedLayers;
            if (selectedLayers.length === 0) {
                alert("Please select a layer to define the null positions.");
                return;
            }
            var referenceLayer = selectedLayers[0];

            app.beginUndoGroup("Create Control Nulls"); // Start undo group

            // Create Head Control Null
            var headControlNull = comp.layers.addNull(comp.duration);
            headControlNull.name = "Head_Control";
            headControlNull.position.setValue(referenceLayer.transform.position.value);
			
			// Parent the selected layer to the Head Control Null
			referenceLayer.parent = headControlNull;

            // Create Look Control Null, parented to Head Control Null
            var lookControlNull = comp.layers.addNull(comp.duration);
            lookControlNull.name = "Look_Control";
            lookControlNull.parent = headControlNull;
            lookControlNull.position.setValue([0, 0]); // Position at [0,0] relative to parent's anchor point
			lookControlNull.scale.setValue([50, 50]);

            app.endUndoGroup(); // End undo group
        }

		function applyParallax(multiplier) {
			var comp = app.project.activeItem;
			if (!(comp && comp instanceof CompItem)) {
				alert("Please select a composition.");
				return;
			}

			var selectedLayers = comp.selectedLayers;
			if (selectedLayers.length === 0) {
				alert("Please select at least one layer to apply the parallax.");
				return;
			}
			
			app.beginUndoGroup("Apply Parallax Expression"); // Start undo group

			for (var i = 0; i < selectedLayers.length; i++) {
				var layer = selectedLayers[i];

				// Make sure the layer isn't one of the control nulls
				if (layer.name !== "Head_Control" && layer.name !== "Look_Control") {
					var expression = "value + thisComp.layer('Look_Control').transform.position * " + multiplier + ";";
					layer.transform.position.expression = expression;
				}
			}

			app.endUndoGroup(); // End undo group
		}

        win.onShow = function () {
            win.layout.resize();
        }
        if (win instanceof Window) {
            win.show();
        } else {
            win.layout.layout(true);
        }
    }

    buildUI(this);
}
