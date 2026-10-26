// ZenEasyRig.jsx - simple rigging panel for After Effects
// Dock it: copy to "Scripts/ScriptUI Panels" and open it from the Window menu.
//
// IK tab: 3 layers, 3 points or 1 path -> "Create IK".
// Face tab: Head + Look controls, move / squash / flip / show-hide, eye generator.
// Every expression it writes is short and commented so you can edit it by hand.

(function (thisObj) {

    var ZER = {};

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function num(n) {
        return String(Math.round(n * 1000) / 1000);
    }

    function q(s) {
        return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    }

    // Evaluates an expression in the comp (on a temporary null) and returns its value.
    function evalInComp(comp, expr) {
        var tmp = comp.layers.addNull();
        tmp.moveToEnd(); // keeps the other layers' indices unchanged
        tmp.transform.position.expression = expr;
        var v = tmp.transform.position.valueAtTime(comp.time, false);
        var solid = tmp.source;
        tmp.remove();
        solid.remove(); // don't leave "Null N" solids in the project
        return v;
    }

    function worldPoint(comp, layer) {
        var L = "thisComp.layer(" + layer.index + ")";
        return evalInComp(comp, L + ".toWorld(" + L + ".anchorPoint)");
    }

    // World angle (degrees) of a layer's x axis, 0 if no layer.
    function worldAngle(comp, layer) {
        if (!layer) return 0;
        var L = "thisComp.layer(" + layer.index + ")";
        return evalInComp(comp, "v = " + L + ".toWorldVec([1,0]); [radiansToDegrees(Math.atan2(v[1], v[0])), 0]")[0];
    }

    function dist(a, b) {
        var dx = b[0] - a[0], dy = b[1] - a[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function angleDeg(from, to) {
        return Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
    }

    function wrap180(a) {
        return ((a % 360) + 540) % 360 - 180;
    }

    function layerByName(comp, name) {
        for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === name) return comp.layer(i);
        return null;
    }

    function uniqueName(comp, base) {
        var name = base, n = 2;
        while (true) {
            var taken = false;
            for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === name) { taken = true; break; }
            if (!taken) return name;
            name = base + " " + n++;
        }
    }

    // ------------------------------------------------------------------
    // Controllers (Null, or Shape layer with Guide Layer on)
    // ------------------------------------------------------------------

    ZER.makeController = function (comp, name, type, pos, size, scaleNull) {
        var c;
        if (type === "Shape") {
            // a square with a crosshair, so you can see when it's rotated
            c = comp.layers.addShape();
            var grp = c.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
            grp.name = "Crosshair";
            var e = size * 0.75;   // crosshair reaches past the square
            var shapes = grp.property("ADBE Vectors Group");
            shapes.addProperty("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([size, size]);
            var lines = [[[-e, 0], [e, 0]], [[0, -e], [0, e]]];
            for (var i = 0; i < lines.length; i++) {
                var sh = new Shape(); sh.vertices = lines[i]; sh.closed = false;
                c.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group")
                    .addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
            }
            var stroke = c.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
            stroke.property("ADBE Vector Stroke Color").setValue([1, 0.75, 0]);
            stroke.property("ADBE Vector Stroke Width").setValue(3);
            c.guideLayer = true;
            c.transform.anchorPoint.setValue([0, 0]);
        } else {
            c = comp.layers.addNull();
            // nulls stay at 100% so layers parented to them keep a clean 100% scale
            // (pass scaleNull to shrink a null that nothing is parented to)
            if (scaleNull) c.transform.scale.setValue([scaleNull, scaleNull]);
        }
        c.name = uniqueName(comp, name);
        c.label = 2; // yellow
        c.transform.position.setValue([pos[0], pos[1]]);
        return c;
    };

    // ------------------------------------------------------------------
    // IK expressions
    // ------------------------------------------------------------------

    // Shared lines: distance shoulder -> controller, with soft IK.
    function softLines() {
        return [
            "// soft IK: ease into full reach instead of popping straight",
            "L = len1 + len2;",
            "s = L * soft / 100;",
            "if (s > 0 && d > L - s) d = L - s + s * (1 - Math.exp(-(d - (L - s)) / s));",
            "d = clamp(d, Math.abs(len1 - len2) + 0.1, L);"
        ];
    }

    function headerLines(o) {
        return [
            "ctrl = thisComp.layer(" + q(o.ctrl) + ");",
            "len1 = " + num(o.len1) + ";   // upper bone length (px)",
            "len2 = " + num(o.len2) + ";   // lower bone length (px)"
        ];
    }

    function controlLines(o) {
        return [
            o.ikfk ? "blend = ctrl.effect(\"IK / FK\")(\"Slider\") / 100;   // 1 = IK, 0 = FK" : "blend = 1;",
            "soft  = ctrl.effect(\"Soft IK\")(\"Slider\");",
            "flip  = ctrl.effect(\"Flip Bend\")(\"Checkbox\") == 1 ? -1 : 1;"
        ];
    }

    ZER.upperRotationExpr = function (o) {
        return [].concat(
            ["// Zen Easy Rig - IK upper bone"],
            headerLines(o),
            ["rest = " + num(o.restUpper) + ";   // bone direction when Rotation is 0", ""],
            controlLines(o),
            ["",
             "A = toWorld(anchorPoint);            // shoulder",
             "C = ctrl.toWorld(ctrl.anchorPoint);  // controller",
             "d = length(A, C);",
             ""],
            softLines(),
            ["",
             "// law of cosines: angle at the shoulder",
             "a = Math.acos(clamp((len1*len1 + d*d - len2*len2) / (2*len1*d), -1, 1));",
             "aim = Math.atan2(C[1] - A[1], C[0] - A[0]);",
             "p = hasParent ? parent.toWorldVec([1, 0]) : [1, 0];   // parent's angle",
             "ik = radiansToDegrees(aim - flip*a - Math.atan2(p[1], p[0])) - rest;",
             "",
             "// blend with the FK rotation (the keyframes on this layer)",
             "diff = ((ik - value) % 360 + 540) % 360 - 180;",
             "value + diff * blend;"]
        ).join("\n");
    };

    ZER.lowerRotationExpr = function (o) {
        return [].concat(
            ["// Zen Easy Rig - IK lower bone"],
            headerLines(o),
            ["rest = " + num(o.restLower) + ";   // angle between the bones' rest directions", ""],
            controlLines(o),
            ["",
             "A = parent.toWorld(parent.anchorPoint);  // shoulder",
             "C = ctrl.toWorld(ctrl.anchorPoint);      // controller",
             "d = length(A, C);",
             ""],
            softLines(),
            ["",
             "// law of cosines: angle at the elbow",
             "b = Math.acos(clamp((len1*len1 + len2*len2 - d*d) / (2*len1*len2), -1, 1));",
             "ik = flip * (180 - radiansToDegrees(b)) + rest;",
             "",
             "// blend with the FK rotation (the keyframes on this layer)",
             "diff = ((ik - value) % 360 + 540) % 360 - 180;",
             "value + diff * blend;"]
        ).join("\n");
    };

    // Position of a child bone, pushed along its parent bone when stretching.
    ZER.stretchExpr = function (o, shoulderRef) {
        return [].concat(
            ["// Zen Easy Rig - IK stretch"],
            headerLines(o),
            [""],
            controlLines(o).slice(0, 2),
            ["on = ctrl.effect(\"Stretch\")(\"Checkbox\");",
             "",
             "up = " + shoulderRef + ";",
             "A = up.toWorld(up.anchorPoint);      // shoulder",
             "C = ctrl.toWorld(ctrl.anchorPoint);  // controller",
             "d = length(A, C);",
             "raw = d;",
             ""],
            softLines(),
            ["",
             "// how much longer than the arm the controller is",
             "stretch = 1 + Math.max(0, raw / d - 1) * on * blend;",
             "a = parent.anchorPoint;",
             "a + (value - a) * stretch;"]
        ).join("\n");
    };

    ZER.endRotationExpr = function (o) {
        return [
            "// Zen Easy Rig - end layer follows the controller's rotation",
            "ctrl = thisComp.layer(" + q(o.ctrl) + ");",
            "offset = " + num(o.endOffset) + ";   // keeps the rest pose",
            "",
            "follow = ctrl.effect(\"End Follows Ctrl\")(\"Slider\") / 100" + (o.ikfk ? " * ctrl.effect(\"IK / FK\")(\"Slider\") / 100" : "") + ";   // 1 = fully follows",
            "c = ctrl.toWorldVec([1, 0]);",
            "p = parent.toWorldVec([1, 0]);",
            "turn = radiansToDegrees(Math.atan2(c[1], c[0]) - Math.atan2(p[1], p[0])) + offset;",
            "turn = (turn % 360 + 540) % 360 - 180;",
            "value + turn * follow;"
        ].join("\n");
    };

    // ------------------------------------------------------------------
    // IK builder
    // ------------------------------------------------------------------

    // Creates the IK controller at pos with its effects.
    // A, B, E = root, joint and end in world space (rest pose).
    function addIKController(comp, name, opt, A, B, E, bend, endFollow) {
        var len1 = dist(A, B), len2 = dist(B, E);
        var size = Math.max(20, Math.min(120, len2 * 0.4));
        var ctrl = ZER.makeController(comp, name, opt.ctrlType, E, size);
        var fx = ctrl.property("ADBE Effect Parade");
        if (opt.ikfk) {
            var b = fx.addProperty("ADBE Slider Control"); b.name = "IK / FK";
            b.property(1).setValue(100);
        }
        var sft = fx.addProperty("ADBE Slider Control"); sft.name = "Soft IK";
        // A nearly straight rest pose sits inside the soft zone and would move,
        // so lower Soft IK just enough to keep the pose (raise it later if you like).
        var L = len1 + len2;
        var maxSoft = Math.floor((L - dist(A, E)) / L * 1000) / 10;
        sft.property(1).setValue(Math.max(0, Math.min(opt.soft, maxSoft)));
        var fl = fx.addProperty("ADBE Checkbox Control"); fl.name = "Flip Bend";
        fl.property(1).setValue(bend > 0 ? 1 : 0);
        if (opt.stretch) {
            var st = fx.addProperty("ADBE Checkbox Control"); st.name = "Stretch";
            st.property(1).setValue(1);
        }
        if (endFollow) {
            var ef = fx.addProperty("ADBE Slider Control"); ef.name = "End Follows Ctrl";
            ef.property(1).setValue(100);
        }
        return ctrl;
    }

    // ------------------------------------------------------------------
    // Point IK: any 3 two-dimensional points (puppet pins, effect points,
    // shape group positions, layer positions). Root, middle, end in timeline order.
    // ------------------------------------------------------------------

    function layerOf(prop) {
        return prop.propertyGroup(prop.propertyDepth);
    }

    function isLayerPosition(prop) {
        return prop.matchName === "ADBE Position" && prop.propertyGroup(1).matchName === "ADBE Transform Group";
    }

    ZER.isPointProp = function (prop) {
        if (prop.propertyType !== PropertyType.PROPERTY) return false;
        var t = prop.propertyValueType;
        if (t === PropertyValueType.TwoD || t === PropertyValueType.TwoD_SPATIAL) return true;
        return isLayerPosition(prop) && !layerOf(prop).threeDLayer;
    };

    // Expression text that points to a property, e.g. thisComp.layer("Arm").effect("Puppet")...
    ZER.propRef = function (prop) {
        // Puppet pins get the familiar short form
        if (prop.matchName === "ADBE FreePin3 PosPin Position") {
            var pin = prop.parentProperty, mesh = pin.parentProperty.parentProperty, puppet = mesh.parentProperty.parentProperty.parentProperty;
            return "thisComp.layer(" + q(layerOf(prop).name) + ").effect(" + q(puppet.name) + ").arap.mesh(" + q(mesh.name) + ").deform(" + q(pin.name) + ").position";
        }
        var parts = [], p = prop;
        while (p.propertyDepth > 0) {
            var up = p.parentProperty;
            var byName = up.propertyType === PropertyType.INDEXED_GROUP || (up.parentProperty && up.parentProperty.matchName === "ADBE Effect Parade");
            parts.unshift("(" + q(byName ? p.name : p.matchName) + ")");
            p = up;
        }
        return "thisComp.layer(" + q(p.name) + ")" + parts.join("");
    };

    // Expression text giving a property's point in world (comp) space.
    function worldRef(prop) {
        var L = "thisComp.layer(" + q(layerOf(prop).name) + ")";
        if (isLayerPosition(prop)) return L + ".toWorld(" + L + ".anchorPoint)";
        return L + ".toWorld(" + ZER.propRef(prop) + ")";
    }

    ZER.pointExpr = function (o, isMiddle, prop) {
        var lines = [
            "// Zen Easy Rig - IK " + (isMiddle ? "middle" : "end") + " point",
            "ctrl = thisComp.layer(" + q(o.ctrl) + ");",
            "len1 = " + num(o.len1) + ";   // root -> middle length (px)",
            "len2 = " + num(o.len2) + ";   // middle -> end length (px)",
            ""
        ].concat(controlLines(o));
        if (o.stretch) lines.push("on    = ctrl.effect(\"Stretch\")(\"Checkbox\");");
        lines = lines.concat([
            "",
            "A = " + o.rootWorld + ";   // root point",
            "C = ctrl.toWorld(ctrl.anchorPoint);   // controller",
            "d = length(A, C);",
            "raw = d;",
            ""
        ], softLines(), [
            o.stretch ? "stretch = 1 + Math.max(0, raw / d - 1) * on;" : "stretch = 1;",
            "",
            "aim = Math.atan2(C[1] - A[1], C[0] - A[0]);"
        ]);
        if (isMiddle) {
            lines = lines.concat([
                "// law of cosines: angle at the root",
                "a = Math.acos(clamp((len1*len1 + d*d - len2*len2) / (2*len1*d), -1, 1));",
                "dir = aim - flip * a;",
                "P = A + [Math.cos(dir), Math.sin(dir)] * len1 * stretch;"
            ]);
        } else {
            lines.push("P = A + [Math.cos(aim), Math.sin(aim)] * d * stretch;");
        }
        lines = lines.concat([
            "",
            "// back to this property's space, blended with its own keyframes (FK)",
            isLayerPosition(prop) ? "p = hasParent ? parent.fromWorld(P) : P;" : "p = fromWorld(P);",
            "ik = [p[0], p[1]];",
            "value + (ik - value) * blend;"
        ]);
        return lines.join("\n");
    };

    ZER.createPointIK = function (comp, props, opt) {
        if (!(comp instanceof CompItem)) throw new Error("Open a composition first.");
        if (!props || props.length !== 3) throw new Error("Select exactly 3 point properties: root, middle, end.");
        for (var i = 0; i < 3; i++) {
            if (!ZER.isPointProp(props[i])) throw new Error("\"" + props[i].name + "\" is not a 2D point.");
            if (props[i].expression !== "") throw new Error("\"" + props[i].name + "\" already has an expression.");
        }
        // Puppet pins are listed newest first in the timeline, so use their numbers: Pin 1 = root
        var nums = [];
        for (var n = 0; n < 3; n++) { var m = props[n].parentProperty.name.match(/(\d+)$/); nums.push(m ? parseInt(m[1], 10) : NaN); }
        if (props[0].matchName === "ADBE FreePin3 PosPin Position" && !isNaN(nums[0] + nums[1] + nums[2])) {
            props = props.slice(0).sort(function (x, y) { return parseInt(x.parentProperty.name.match(/(\d+)$/)[1], 10) - parseInt(y.parentProperty.name.match(/(\d+)$/)[1], 10); });
        }
        var root = props[0], mid = props[1], end = props[2];

        var A = evalInComp(comp, worldRef(root)), B = evalInComp(comp, worldRef(mid)), E = evalInComp(comp, worldRef(end));
        var len1 = dist(A, B), len2 = dist(B, E);
        if (len1 < 0.5 || len2 < 0.5) throw new Error("The three points must not sit on top of each other.");
        var bend = wrap180(angleDeg(A, B) - angleDeg(A, E));

        // readable controller name: "Wrist", "Puppet Pin 3", "Point 3"...
        var endName = isLayerPosition(end) ? layerOf(end).name : (end.name === "Position" ? end.parentProperty.name : end.name);
        var ctrl = addIKController(comp, "CTRL IK " + endName, opt, A, B, E, bend, false);
        ctrl.moveBefore(comp.layer(Math.min(layerOf(root).index, layerOf(mid).index, layerOf(end).index)));

        var o = { ctrl: ctrl.name, len1: len1, len2: len2, ikfk: opt.ikfk, stretch: opt.stretch, rootWorld: worldRef(root) };
        mid.expression = ZER.pointExpr(o, true, mid);
        end.expression = ZER.pointExpr(o, false, end);
        return ctrl;
    };

    // ------------------------------------------------------------------
    // Spline IK: one path (shape path or mask) with 3 or more points.
    // First point = root, last point = follows the controller, one point
    // in between = the joint ("elbow"). Points before / after the joint
    // move rigidly with their half, so curves keep their shape.
    // The path's own keyframes are the FK pose.
    // ------------------------------------------------------------------

    ZER.pathProp = function (prop) {
        if (prop.propertyType === PropertyType.PROPERTY) return prop.propertyValueType === PropertyValueType.SHAPE ? prop : null;
        if (prop.matchName === "ADBE Vector Shape - Group") return prop.property("ADBE Vector Shape");
        if (prop.matchName === "ADBE Mask Atom") return prop.property("ADBE Mask Shape");
        return null;
    };

    ZER.splineExpr = function (o) {
        var lines = [
            "// Zen Easy Rig - spline IK",
            "ctrl = thisComp.layer(" + q(o.ctrl) + ");",
            "joint = " + o.joint + ";   // the point that bends (0 = first point)",
            ""
        ].concat(controlLines(o));
        if (o.stretch) lines.push("on    = ctrl.effect(\"Stretch\")(\"Checkbox\");");
        lines.push("curve = ctrl.effect(\"Curve %\")(\"Slider\") / 100;   // handle length: 1 = as drawn, 0 = straight, 2 = double");
        lines = lines.concat([
            "",
            "// rest shape = this path's own keyframes (FK)",
            "pts = points();  inT = inTangents();  outT = outTangents();",
            "n = pts.length;",
            "",
            "// Flip Bend changed since rigging: use the drawing mirrored across the shoulder-wrist line,",
            "// so the elbow bends the other way and keeps its rounding",
            "restFlip = " + (o.restFlip || 1) + ";   // bend direction the arm was drawn with",
            "if (flip != restFlip) {",
            "  S = pts[0];  ax = normalize(pts[n - 1] - S);",
            "  for (i = 0; i < n; i++) {",
            "    q = pts[i] - S;  pts[i] = S + ax * 2 * dot(q, ax) - q;",
            "    inT[i] = ax * 2 * dot(inT[i], ax) - inT[i];",
            "    outT[i] = ax * 2 * dot(outT[i], ax) - outT[i];",
            "  }",
            "}",
            "",
            "A = pts[0];  B = pts[joint];  E = pts[n - 1];",
            "len1 = length(A, B);",
            "len2 = length(B, E);",
            "",
            "C = fromWorld(ctrl.toWorld(ctrl.anchorPoint));   // controller, in this layer",
            "d = length(A, C);",
            "raw = d;",
            ""
        ], softLines(), [
            o.stretch ? "stretch = 1 + Math.max(0, raw / d - 1) * on * blend;" : "stretch = 1;",
            "",
            "// law of cosines: where the joint and the end go",
            "aim = Math.atan2(C[1] - A[1], C[0] - A[0]);",
            "a = Math.acos(clamp((len1*len1 + d*d - len2*len2) / (2*len1*d), -1, 1));",
            "up = aim - flip * a;",
            "ikB = A + [Math.cos(up), Math.sin(up)] * len1;",
            "ikE = A + [Math.cos(aim), Math.sin(aim)] * d;",
            "",
            "// how much each half turns, blended with FK",
            "function ang(v) { return Math.atan2(v[1], v[0]); }",
            "function wrap(r) { while (r > Math.PI) r -= 2*Math.PI; while (r < -Math.PI) r += 2*Math.PI; return r; }",
            "r1 = wrap(ang(ikB - A) - ang(B - A)) * blend;",
            "r2 = wrap(ang(ikE - ikB) - ang(E - B)) * blend;",
            "function rot(v, r) { return [v[0]*Math.cos(r) - v[1]*Math.sin(r), v[0]*Math.sin(r) + v[1]*Math.cos(r)]; }",
            "",
            "// keep the elbow round without loops: the more it bends, the shorter its handles",
            "restBend = wrap(ang(E - B) - ang(B - A));",
            "turn = wrap(r2 - r1);   // how much the elbow turned since the rest pose",
            "bend = restBend + turn;",
            "elbow = clamp(Math.cos(bend / 2) / Math.max(0.2, Math.cos(restBend / 2)), 0, 1.5);",
            "",
            "newB = A + rot(B - A, r1) * stretch;",
            "P = [];  I = [];  O = [];",
            "for (i = 0; i < n; i++) {",
            "  k = curve;",
            "  if (i < joint) { r = r1;  P[i] = A + rot(pts[i] - A, r) * stretch; }",
            "  else if (i == joint) { r = r1 + turn / 2;  P[i] = newB;  k = curve * elbow; }   // halfway between both bones",
            "  else { r = r2;  P[i] = newB + rot(pts[i] - B, r) * stretch; }",
            "  I[i] = rot(inT[i], r) * k;",
            "  O[i] = rot(outT[i], r) * k;",
            "}",
            "createPath(P, I, O, isClosed());"
        ]);
        return lines.join("\n");
    };

    ZER.createSplineIK = function (comp, pathProp, opt) {
        if (!(comp instanceof CompItem)) throw new Error("Open a composition first.");
        if (pathProp.expression !== "") throw new Error("This path already has an expression.");
        var shape = pathProp.value, verts = shape.vertices, n = verts.length;
        if (n < 3) throw new Error("The path needs at least 3 points (root, joint, end).");
        var layer = layerOf(pathProp);
        var joint = Math.floor((n - 1) / 2);

        // rest pose in world space
        var ref = ZER.propRef(pathProp), L = "thisComp.layer(" + q(layer.name) + ")";
        function vWorld(i) { return evalInComp(comp, "p = " + ref + ".points(); " + L + ".toWorld(p[" + i + "])"); }
        var A = vWorld(0), B = vWorld(joint), E = vWorld(n - 1);
        var len2 = dist(B, E);
        var bend = wrap180(angleDeg(A, B) - angleDeg(A, E));

        var nm = pathProp.parentProperty.name;
        var ctrl = addIKController(comp, "CTRL IK " + (nm || layer.name), opt, A, B, E, bend, false);
        ctrl.moveBefore(layer);
        var cv = ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
        cv.name = "Curve %";
        cv.property(1).setValue(100);

        pathProp.expression = ZER.splineExpr({ ctrl: ctrl.name, joint: joint, ikfk: opt.ikfk, stretch: opt.stretch, restFlip: bend > 0 ? -1 : 1 });
        return ctrl;
    };

    // ------------------------------------------------------------------
    // Group IK: 3 groups in the same shape layer (upper arm, forearm, hand).
    // Groups can't be parented to each other, so each one gets its own
    // Position / Rotation expression and moves like a bone.
    // Put each group's Anchor Point on its joint (shoulder, elbow, wrist).
    // ------------------------------------------------------------------

    function groupTr(g, m) { return g.property("ADBE Vector Transform Group").property(m); }

    // Where the solver lines need the shoulder and the controller, in the layer's own space.
    function groupSolverLines(o) {
        return [
            "A = " + o.shoulderRef + ";   // shoulder (the upper group's position)",
            "C = fromWorld(ctrl.toWorld(ctrl.anchorPoint));   // controller, in this layer",
            "d = length(A, C);",
            "raw = d;",
            ""
        ].concat(softLines(), [
            o.stretch ? "stretch = 1 + Math.max(0, raw / d - 1) * ctrl.effect(\"Stretch\")(\"Checkbox\");" : "stretch = 1;",
            "",
            "// law of cosines: where the elbow and the wrist go",
            "aim = Math.atan2(C[1] - A[1], C[0] - A[0]);",
            "a = Math.acos(clamp((len1*len1 + d*d - len2*len2) / (2*len1*d), -1, 1));",
            "up = aim - flip * a;   // upper bone angle",
            "B = A + [Math.cos(up), Math.sin(up)] * len1 * stretch;   // elbow",
            "E = A + [Math.cos(aim), Math.sin(aim)] * d * stretch;    // wrist",
            "function wrap(r) { while (r > Math.PI) r -= 2*Math.PI; while (r < -Math.PI) r += 2*Math.PI; return r; }"
        ]);
    }

    // part: "upperRot", "midPos", "midRot", "endPos", "endRot"
    ZER.groupIKExpr = function (o, part) {
        var lines = [
            "// Zen Easy Rig - group IK (" + { upperRot: "upper rotation", midPos: "lower position", midRot: "lower rotation", endPos: "end position", endRot: "end rotation" }[part] + ")",
            "ctrl = thisComp.layer(" + q(o.ctrl) + ");",
            "len1 = " + num(o.len1) + ";   // upper bone length (px)",
            "len2 = " + num(o.len2) + ";   // lower bone length (px)",
            "rest1 = degreesToRadians(" + num(o.rest1 * 180 / Math.PI) + ");   // upper bone angle at rest",
            "rest2 = degreesToRadians(" + num(o.rest2 * 180 / Math.PI) + ");   // lower bone angle at rest",
            ""
        ].concat(controlLines(o), [""], groupSolverLines(o), [""]);
        if (part === "upperRot") lines.push("value + radiansToDegrees(wrap(up - rest1)) * blend;");
        if (part === "midPos") lines.push("value + (B - value) * blend;");
        if (part === "midRot" || (part === "endRot" && !o.endFollow)) lines.push("value + radiansToDegrees(wrap(Math.atan2(E[1] - B[1], E[0] - B[0]) - rest2)) * blend;   // turns with the lower bone");
        if (part === "endRot" && o.endFollow) lines = lines.concat([
            "// the hand turns with the forearm, or with the controller's rotation (End Follows Ctrl)",
            "boneTurn = radiansToDegrees(wrap(Math.atan2(E[1] - B[1], E[0] - B[0]) - rest2));",
            "c = ctrl.toWorldVec([1, 0]);  l = toWorldVec([1, 0]);   // controller and this layer, in the comp",
            "ctrlTurn = radiansToDegrees(wrap(Math.atan2(c[1], c[0]) - Math.atan2(l[1], l[0]) - degreesToRadians(" + num(o.ctrlRest) + ")));   // controller rotation since rigging",
            "follow = ctrl.effect(\"End Follows Ctrl\")(\"Slider\") / 100;",
            "value + (boneTurn + (ctrlTurn - boneTurn) * follow) * blend;"
        ]);
        if (part === "endPos") lines.push("value + (E - value) * blend;");
        return lines.join("\n");
    };

    ZER.createGroupIK = function (comp, groups, opt) {
        if (groups.length !== 3) throw new Error("Select exactly 3 groups: upper, lower and end (e.g. arm, forearm, hand).");
        var layer = layerOf(groups[0]);
        // where a group sits: layer index + the chain of indices of the groups above it
        function home(g) { var s = "", p = g.parentProperty; while (p.propertyDepth > 0) { s = p.propertyIndex + "/" + s; p = p.parentProperty; } return layerOf(g).index + ":" + s; }
        for (var i = 1; i < 3; i++) {
            if (layerOf(groups[i]).index !== layer.index) throw new Error("The 3 groups must be in the same shape layer.");
            if (home(groups[i]) !== home(groups[0])) throw new Error("The 3 groups must sit side by side in the same Contents (not inside each other).");
        }
        // remember the groups by index (adding layers and expressions can invalidate references)
        var parentPath = [], g = groups[0].parentProperty;
        while (g.propertyDepth > 0) { parentPath.unshift(g.propertyIndex); g = g.parentProperty; }
        function getGroup(idx) { var c = layer; for (var k = 0; k < parentPath.length; k++) c = c.property(parentPath[k]); return c.property(idx); }
        var idx = [groups[0].propertyIndex, groups[1].propertyIndex, groups[2].propertyIndex];
        var pos = [];
        for (i = 0; i < 3; i++) pos.push(groupTr(groups[i], "ADBE Vector Position").value);
        // the middle group is the one closest to the other two; of the two ends, the lower one in the timeline is the root
        var best = 0, bestSum = Infinity;
        for (i = 0; i < 3; i++) {
            var sum = 0; for (var j = 0; j < 3; j++) if (j !== i) sum += dist(pos[i], pos[j]);
            if (sum < bestSum) { bestSum = sum; best = i; }
        }
        // Which end is the shoulder? The upper arm's drawing reaches from its joint TOWARD the elbow,
        // while the hand's drawing reaches AWAY from it. If that can't decide, the end higher in the timeline is the shoulder.
        var ends = []; for (i = 0; i < 3; i++) if (i !== best) ends.push(i);
        function towardMiddle(e) {
            if (!parentPath.length || parentPath.length > 1) return 0;   // only for groups at the top of the layer
            var b = shapeBounds(comp, layer, idx[e]);
            var c = [b.left + b.width / 2, b.top + b.height / 2];
            var v = [pos[best][0] - pos[e][0], pos[best][1] - pos[e][1]];
            return ((c[0] - pos[e][0]) * v[0] + (c[1] - pos[e][1]) * v[1]) / Math.max(1e-6, Math.sqrt(v[0] * v[0] + v[1] * v[1]));
        }
        var t0 = towardMiddle(ends[0]), t1 = towardMiddle(ends[1]), rootI;
        if (t0 > 1 && t1 <= 1) rootI = ends[0];
        else if (t1 > 1 && t0 <= 1) rootI = ends[1];
        else rootI = idx[ends[0]] < idx[ends[1]] ? ends[0] : ends[1];
        var endI = rootI === ends[0] ? ends[1] : ends[0];
        var order = [idx[rootI], idx[best], idx[endI]], P = [pos[rootI], pos[best], pos[endI]];
        var len1 = dist(P[0], P[1]), len2 = dist(P[1], P[2]);
        if (len1 < 0.5 || len2 < 0.5) throw new Error("Put each group's Anchor Point on its joint first: the groups' positions are on top of each other.");
        var rest1 = Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]), rest2 = Math.atan2(P[2][1] - P[1][1], P[2][0] - P[1][0]);

        // world points for the controller and the bend direction
        var L = "thisComp.layer(" + layer.index + ")";
        var Aw = evalInComp(comp, L + ".toWorld([" + P[0][0] + "," + P[0][1] + "])");
        var Bw = evalInComp(comp, L + ".toWorld([" + P[1][0] + "," + P[1][1] + "])");
        var Ew = evalInComp(comp, L + ".toWorld([" + P[2][0] + "," + P[2][1] + "])");
        var bend = wrap180(angleDeg(Aw, Bw) - angleDeg(Aw, Ew));
        var endName = getGroup(order[2]).name;
        var ctrl = addIKController(comp, "CTRL IK " + endName, opt, Aw, Bw, Ew, bend, opt.endFollow);
        ctrl.moveBefore(layer);
        var ctrlRest = opt.endFollow ? worldAngle(comp, ctrl) - worldAngle(comp, layer) : 0;

        // the Contents the 3 groups sit in, seen from any of their transform properties
        var shoulderRef = "thisProperty.propertyGroup(3)(" + q(getGroup(order[0]).name) + ").transform.position";
        var o = { ctrl: ctrl.name, len1: len1, len2: len2, rest1: rest1, rest2: rest2, ikfk: opt.ikfk, stretch: opt.stretch, shoulderRef: shoulderRef, endFollow: opt.endFollow, ctrlRest: ctrlRest };
        groupTr(getGroup(order[0]), "ADBE Vector Rotation").expression = ZER.groupIKExpr(o, "upperRot");
        groupTr(getGroup(order[1]), "ADBE Vector Position").expression = ZER.groupIKExpr(o, "midPos");
        groupTr(getGroup(order[1]), "ADBE Vector Rotation").expression = ZER.groupIKExpr(o, "midRot");
        groupTr(getGroup(order[2]), "ADBE Vector Position").expression = ZER.groupIKExpr(o, "endPos");
        groupTr(getGroup(order[2]), "ADBE Vector Rotation").expression = ZER.groupIKExpr(o, "endRot");
        return { ctrl: ctrl, order: [getGroup(order[0]).name, getGroup(order[1]).name, getGroup(order[2]).name] };
    };

    // ------------------------------------------------------------------
    // Puppet pin chain IK: every pin of a Puppet effect, in pin order.
    // Pin 1 = root, last pin = follows the controller, the middle pin = the elbow.
    // Pins before the elbow move with the upper bone, pins after it with the lower bone.
    // ------------------------------------------------------------------

    function puppetPins(puppet) {
        var deform = puppet.property("ADBE FreePin3 ARAP Group").property("ADBE FreePin3 Mesh Group").property(1).property("ADBE FreePin3 PosPins");
        var pins = [];
        for (var i = 1; i <= deform.numProperties; i++) {
            var m = deform.property(i).name.match(/(\d+)$/);
            pins.push({ index: i, name: deform.property(i).name, num: m ? parseInt(m[1], 10) : i });
        }
        pins.sort(function (a, b) { return a.num - b.num; });   // AE lists pins newest first
        return pins;
    }

    ZER.pinChainExpr = function (o, k) {
        var lines = [
            "// Zen Easy Rig - puppet pin IK (pin " + (k + 1) + " of " + o.n + ")",
            "ctrl = thisComp.layer(" + q(o.ctrl) + ");",
            "A0 = [" + num(o.A0[0]) + ", " + num(o.A0[1]) + "];   // shoulder pin at rest",
            "B0 = [" + num(o.B0[0]) + ", " + num(o.B0[1]) + "];   // elbow pin at rest",
            "E0 = [" + num(o.E0[0]) + ", " + num(o.E0[1]) + "];   // end pin at rest",
            "len1 = length(A0, B0);  len2 = length(B0, E0);",
            ""
        ].concat(controlLines(o), [
            "",
            "A = " + o.rootRef + ";   // the shoulder pin (can be animated)",
            "C = fromWorld(ctrl.toWorld(ctrl.anchorPoint));   // controller, in this layer",
            "d = length(A, C);",
            "raw = d;",
            ""
        ], softLines(), [
            o.stretch ? "stretch = 1 + Math.max(0, raw / d - 1) * ctrl.effect(\"Stretch\")(\"Checkbox\");" : "stretch = 1;",
            "",
            "// law of cosines: where the elbow and the end go",
            "aim = Math.atan2(C[1] - A[1], C[0] - A[0]);",
            "a = Math.acos(clamp((len1*len1 + d*d - len2*len2) / (2*len1*d), -1, 1));",
            "up = aim - flip * a;",
            "B = A + [Math.cos(up), Math.sin(up)] * len1 * stretch;",
            "E = A + [Math.cos(aim), Math.sin(aim)] * d * stretch;",
            "function ang(v) { return Math.atan2(v[1], v[0]); }",
            "function rot(v, r) { return [v[0]*Math.cos(r) - v[1]*Math.sin(r), v[0]*Math.sin(r) + v[1]*Math.cos(r)]; }",
            ""
        ]);
        if (k <= o.joint) lines.push("ik = A + rot(value - A0, ang(B - A) - ang(B0 - A0)) * stretch;   // moves with the upper bone");
        else lines.push("ik = B + rot(value - B0, ang(E - B) - ang(E0 - B0)) * stretch;   // moves with the lower bone");
        lines.push("value + (ik - value) * blend;");
        return lines.join("\n");
    };

    ZER.createPinChainIK = function (comp, puppet, opt) {
        var layer = layerOf(puppet), pins = puppetPins(puppet), n = pins.length;
        if (n < 3) throw new Error("The Puppet effect needs 3 or more pins (shoulder, elbow, end). It has " + n + ".");
        var puppetName = puppet.name;
        function pinProp(p) {
            return layer.property("ADBE Effect Parade").property(puppetName).property("ADBE FreePin3 ARAP Group").property("ADBE FreePin3 Mesh Group").property(1)
                .property("ADBE FreePin3 PosPins").property(p.index).property("ADBE FreePin3 PosPin Position");
        }
        var rest = [];
        for (var i = 0; i < n; i++) { var pp = pinProp(pins[i]); if (pp.expression !== "") throw new Error("\"" + pins[i].name + "\" already has an expression."); rest.push(pp.value); }
        var joint = Math.floor((n - 1) / 2), A0 = rest[0], B0 = rest[joint], E0 = rest[n - 1];
        if (dist(A0, B0) < 0.5 || dist(B0, E0) < 0.5) throw new Error("The pins sit on top of each other.");
        var L = "thisComp.layer(" + layer.index + ")";
        function w(p) { return evalInComp(comp, L + ".toWorld([" + p[0] + "," + p[1] + "])"); }
        var Aw = w(A0), Bw = w(B0), Ew = w(E0);
        var bend = wrap180(angleDeg(Aw, Bw) - angleDeg(Aw, Ew));
        var ctrl = addIKController(comp, "CTRL IK " + layer.name + " " + pins[n - 1].name, opt, Aw, Bw, Ew, bend, false);
        ctrl.moveBefore(layer);
        var meshName = layer.property("ADBE Effect Parade").property(puppetName).property("ADBE FreePin3 ARAP Group").property("ADBE FreePin3 Mesh Group").property(1).name;
        var rootRef = "effect(" + q(puppetName) + ").arap.mesh(" + q(meshName) + ").deform(" + q(pins[0].name) + ").position";
        var o = { ctrl: ctrl.name, n: n, joint: joint, A0: A0, B0: B0, E0: E0, ikfk: opt.ikfk, stretch: opt.stretch, rootRef: rootRef };
        for (i = 1; i < n; i++) pinProp(pins[i]).expression = ZER.pinChainExpr(o, i);
        return { ctrl: ctrl, pins: n, joint: pins[joint].name };
    };

    // Create IK picks the right kind of IK from what is selected.
    ZER.createIKFromSelection = function (comp, selLayers, sel, opt) {
        var path = null, points = [], groups = [], i;
        // a Puppet effect selected, or a single layer with a Puppet effect: chain IK on all its pins
        for (i = 0; i < sel.length; i++) if (sel[i].matchName === "ADBE FreePin3") return ZER.createPinChainIK(comp, sel[i], opt);
        if (!sel.length && selLayers.length === 1) {
            var fxp = selLayers[0].property("ADBE Effect Parade");
            if (fxp) for (i = 1; i <= fxp.numProperties; i++) if (fxp.property(i).matchName === "ADBE FreePin3") return ZER.createPinChainIK(comp, fxp.property(i), opt);
        }
        for (i = 0; i < sel.length && !path; i++) path = ZER.pathProp(sel[i]);
        for (i = 0; i < sel.length; i++) {
            if (ZER.isPointProp(sel[i])) points.push(sel[i]);
            if (sel[i].matchName === "ADBE Vector Group") groups.push(sel[i]);
        }
        // one shape layer selected that holds exactly 3 groups: rig those groups
        var one = selLayers.length === 1 ? selLayers[0] : null;
        if (!groups.length && !path && !points.length && one && one.matchName === "ADBE Vector Layer") {
            var rcO = one.property("ADBE Root Vectors Group"), gs = [];
            for (i = 1; i <= rcO.numProperties; i++) if (rcO.property(i).matchName === "ADBE Vector Group") gs.push(rcO.property(i));
            if (gs.length !== 3) throw new Error("\"" + one.name + "\" has " + gs.length + " groups. Select 3 groups (or a shape layer with exactly 3), or 3 layers.");
            groups = gs;
        }
        if (groups.length) return ZER.createGroupIK(comp, groups, opt);
        if (path) return ZER.createSplineIK(comp, path, opt);
        if (points.length) return ZER.createPointIK(comp, points, opt);
        return ZER.createIK(comp, selLayers, opt);
    };

    // Point properties among the selection (ignores groups and layers).
    ZER.selectedPoints = function (comp) {
        var out = [], sel = comp.selectedProperties;
        for (var i = 0; i < sel.length; i++) if (ZER.isPointProp(sel[i])) out.push(sel[i]);
        return out;
    };

    // Works out upper / lower / end from parenting, or from selection order.
    ZER.sortChain = function (layers) {
        for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) for (var k = 0; k < 3; k++) {
            if (i === j || j === k || i === k) continue;
            if (layers[j].parent === layers[i] && layers[k].parent === layers[j]) return [layers[i], layers[j], layers[k]];
        }
        return [layers[0], layers[1], layers[2]];
    };

    ZER.createIK = function (comp, layers, opt) {
        if (!(comp instanceof CompItem)) throw new Error("Open a composition first.");
        if (!layers || layers.length !== 3) throw new Error("Select exactly 3 layers: upper, lower and end (e.g. arm, forearm, hand).");
        for (var i = 0; i < 3; i++) if (layers[i].threeDLayer) throw new Error("The IK only works on 2D layers for now.");

        var chain = ZER.sortChain(layers);
        var up = chain[0], low = chain[1], end = chain[2];
        if (low.parent !== up) low.parent = up;
        if (end.parent !== low) end.parent = low;

        // Measure the rest pose
        var A = worldPoint(comp, up), B = worldPoint(comp, low), E = worldPoint(comp, end);
        var len1 = dist(A, B), len2 = dist(B, E);
        if (len1 < 0.5 || len2 < 0.5) throw new Error("The anchor points of the three layers must be at the joints (shoulder, elbow, wrist).");

        // Bone directions in each layer's own space (with Rotation at 0)
        var restUpper = angleDeg(up.transform.anchorPoint.value, low.transform.position.value);
        var restLowerOwn = angleDeg(low.transform.anchorPoint.value, end.transform.position.value);

        // Which way the elbow bends right now (so creating the IK doesn't flip the pose)
        var bend = wrap180(angleDeg(A, B) - angleDeg(A, E));
        var lowAngle = worldAngle(comp, low);

        var ctrl = addIKController(comp, "CTRL IK " + end.name, opt, A, B, E, bend, opt.endFollow);
        ctrl.moveBefore(comp.layer(Math.min(up.index, low.index, end.index)));

        var o = {
            ctrl: ctrl.name, len1: len1, len2: len2, ikfk: opt.ikfk,
            restUpper: restUpper, restLower: restUpper - restLowerOwn
        };

        up.transform.rotation.expression = ZER.upperRotationExpr(o);
        low.transform.rotation.expression = ZER.lowerRotationExpr(o);
        if (opt.stretch) {
            low.transform.position.expression = ZER.stretchExpr(o, "parent");
            end.transform.position.expression = ZER.stretchExpr(o, "thisComp.layer(" + q(up.name) + ")");
        }
        if (opt.endFollow) {
            o.endOffset = lowAngle - worldAngle(comp, ctrl);
            end.transform.rotation.expression = ZER.endRotationExpr(o);
        }
        return ctrl;
    };

    // ------------------------------------------------------------------
    // FACE
    // Head control + Look control (child of Head, rests at [0,0]).
    // Every face part reads the Look control's position as an offset.
    // Works on layers and on groups inside one big shape layer.
    // ------------------------------------------------------------------

    ZER.createFaceControls = function (comp, layers, ctrlType) {
        if (!(comp instanceof CompItem)) throw new Error("Open a composition first.");
        var pos = [comp.width / 2, comp.height / 2];
        if (layers && layers.length) pos = worldPoint(comp, layers[0]);
        var head = ZER.makeController(comp, "CTRL Head", ctrlType, pos, 160);
        var look = ZER.makeController(comp, "CTRL Look", ctrlType, pos, 80, 50);   // half the head's size
        look.parent = head;
        look.transform.position.setValue([0, 0]);
        look.label = 11; // orange
        if (layers && layers.length) {
            // the first selected layer is the base head shape: the head control takes its place
            var base = layers[0];
            if (base.parent) head.parent = base.parent;
            for (var i = 0; i < layers.length; i++) layers[i].parent = head;
        }
        return { head: head, look: look };
    };

    // The transform group of a target: a layer, or a shape group.
    function targetTransform(t) {
        if (t.matchName === "ADBE Vector Group") {
            var tr = t.property("ADBE Vector Transform Group");
            return { position: tr.property("ADBE Vector Position"), scale: tr.property("ADBE Vector Scale"), opacity: tr.property("ADBE Vector Group Opacity"), rotation: tr.property("ADBE Vector Rotation") };
        }
        return { position: t.transform.position, scale: t.transform.scale, opacity: t.transform.opacity, rotation: t.transform.rotation };
    }

    // Selected shape groups if there are any, otherwise the selected layers.
    ZER.faceTargets = function (comp) {
        var out = [], sel = comp.selectedProperties;
        for (var i = 0; i < sel.length; i++) if (sel[i].matchName === "ADBE Vector Group") out.push(sel[i]);
        if (out.length) return out;
        for (var j = 0; j < comp.selectedLayers.length; j++) {
            var L = comp.selectedLayers[j];
            if (L.name.indexOf("CTRL ") !== 0) out.push(L);
        }
        return out;
    };

    function lookLine(lookName) {
        return "look = thisComp.layer(" + q(lookName) + ").transform.position;   // Look offset";
    }

    // depthY = null -> one depth for both directions
    ZER.moveExpr = function (lookName, depth, depthY) {
        if (depthY === null || depthY === undefined) return [
            "// Zen Easy Rig - face move",
            lookLine(lookName),
            "depth = " + num(depth) + ";   // 1 = moves with the look, 0 = stays, negative = behind the head",
            "value + look * depth;"
        ].join("\n");
        return [
            "// Zen Easy Rig - face move",
            lookLine(lookName),
            "depthX = " + num(depth) + ";   // left / right (1 = moves with the look, negative = behind)",
            "depthY = " + num(depthY) + ";   // up / down",
            "value + [look[0] * depthX, look[1] * depthY];"
        ].join("\n");
    };

    ZER.rotateExpr = function (lookName, rx, ry) {
        return [
            "// Zen Easy Rig - face rotation",
            lookLine(lookName),
            "rx = " + num(rx) + ";   // degrees per pixel the look moves left / right",
            "ry = " + num(ry) + ";   // degrees per pixel the look moves up / down",
            "value + look[0] * rx + look[1] * ry;"
        ].join("\n");
    };

    function cond(axis, greater, threshold) {
        return "look[" + (axis === "Y" ? 1 : 0) + "] " + (greater ? ">" : "<") + " " + num(threshold);
    }

    ZER.scaleExpr = function (lookName, o) {
        var lines = ["// Zen Easy Rig - face scale", lookLine(lookName)];
        if (o.squash) {
            var absH = o.absH !== false, absV = o.absV === true;   // default: H both ways, V one way
            lines.push(absH ? "sx = value[0] - Math.abs(look[0]) * " + num(o.h) + ";   // narrower when looking to either side"
                            : "sx = value[0] - look[0] * " + num(o.h) + ";   // narrower one way, wider the other");
            lines.push(absV ? "sy = value[1] - Math.abs(look[1]) * " + num(o.v) + ";   // shorter when looking up or down"
                            : "sy = value[1] - look[1] * " + num(o.v) + ";   // shorter looking down, taller looking up");
        } else {
            lines.push("sx = value[0];", "sy = value[1];");
        }
        if (o.flip) {
            var fy = o.flipAxis === "Y";
            lines.push("if (" + cond(o.flipAxis || "X", o.flipGreater === true, o.flipThreshold || 0) + ") " + (fy ? "sy = -sy;   // flip upside down" : "sx = -sx;   // mirror left / right") + " when the look passes the value");
        }
        lines.push("[sx, sy];");
        return lines.join("\n");
    };

    // Visible only while the look is past a value (front / back parts).
    ZER.showExpr = function (lookName, axis, greater, threshold) {
        return [
            "// Zen Easy Rig - show / hide",
            lookLine(lookName),
            "limit = " + num(threshold) + ";",
            "look[" + (axis === "Y" ? 1 : 0) + "] " + (greater ? ">" : "<") + " limit ? value : 0;"
        ].join("\n");
    };

    function isFaceExpr(e) {
        return e.indexOf("// Zen Easy Rig - face") === 0 || e.indexOf("// Zen Easy Rig - show / hide") === 0;
    }

    // o: { look, move, depth, separate, depthY, squash, h, v, flip, flipAxis, flipGreater, flipThreshold,
    //      rotate, rx, ry, show, axis, greater, threshold }
    ZER.applyFace = function (comp, targets, o) {
        if (!targets.length) throw new Error("Select face layers, or groups inside a shape layer.");
        if (!layerByName(comp, o.look)) throw new Error("There's no layer called \"" + o.look + "\". Click \"Create Head + Look\" first.");
        var props = [];
        for (var i = 0; i < targets.length; i++) props.push(targetTransform(targets[i]));
        // set expressions after collecting (adding expressions doesn't invalidate, but be safe with groups)
        // Ticked options are (re)applied. Unticked ones remove the face expression they left
        // before, so you can try variations. Other expressions (IK, delay, your own) are kept.
        function set(prop, on, expr) {
            if (on) prop.expression = expr();
            else if (isFaceExpr(prop.expression)) prop.expression = "";
        }
        for (var k = 0; k < props.length; k++) {
            var P = props[k];
            set(P.position, o.move, function () { return ZER.moveExpr(o.look, o.depth, o.separate ? o.depthY : null); });
            set(P.rotation, o.rotate, function () { return ZER.rotateExpr(o.look, o.rx, o.ry); });
            set(P.scale, o.squash || o.flip, function () { return ZER.scaleExpr(o.look, o); });
            set(P.opacity, o.show, function () { return ZER.showExpr(o.look, o.axis, o.greater, o.threshold); });
        }
    };

    // Reads back the face settings from a part's expressions (for the "Get" button).
    // Returns the same kind of object applyFace takes; unknown parts stay unset.
    ZER.readFace = function (target) {
        var T = targetTransform(target), o = { move: false, rotate: false, squash: false, flip: false, show: false };
        function grab(text, re) { var m = text.match(re); return m ? parseFloat(m[1]) : null; }
        function lookName(text) { var m = text.match(/look = thisComp\.layer\("([^"]*)"\)/); if (m) o.look = m[1]; }
        var pe = T.position.expression;
        if (isFaceExpr(pe)) {
            o.move = true; lookName(pe);
            if (pe.indexOf("depthX") >= 0) { o.separate = true; o.depth = grab(pe, /depthX = (-?[\d.]+)/); o.depthY = grab(pe, /depthY = (-?[\d.]+)/); }
            else { o.separate = false; o.depth = grab(pe, /depth = (-?[\d.]+)/); }
        }
        var re = T.rotation.expression;
        if (isFaceExpr(re)) { o.rotate = true; lookName(re); o.rx = grab(re, /rx = (-?[\d.]+)/); o.ry = grab(re, /ry = (-?[\d.]+)/); }
        var se = T.scale.expression;
        if (isFaceExpr(se)) {
            lookName(se);
            var h = se.match(/sx = value\[0\] - (Math\.abs\()?look\[0\]\)? \* (-?[\d.]+)/), v = se.match(/sy = value\[1\] - (Math\.abs\()?look\[1\]\)? \* (-?[\d.]+)/);
            if (h || v) {
                o.squash = true;
                o.h = h ? parseFloat(h[2]) : 0; o.absH = h ? !!h[1] : true;
                o.v = v ? parseFloat(v[2]) : 0; o.absV = v ? !!v[1] : false;
            }
            var f = se.match(/if \(look\[(\d)\] ([<>]) (-?[\d.]+)\)/);
            if (f) { o.flip = true; o.flipAxis = f[1] === "1" ? "Y" : "X"; o.flipGreater = f[2] === ">"; o.flipThreshold = parseFloat(f[3]); }
        }
        var oe = T.opacity.expression;
        if (isFaceExpr(oe)) {
            o.show = true; lookName(oe);
            var c = oe.match(/look\[(\d)\] ([<>]) limit/);
            if (c) { o.axis = c[1] === "1" ? "Y" : "X"; o.greater = c[2] === ">"; }
            o.threshold = grab(oe, /limit = (-?[\d.]+)/);
        }
        return o;
    };

    // First target = front (shown past the value), second = back (shown before it).
    ZER.applyPair = function (comp, targets, o) {
        if (targets.length !== 2) throw new Error("Select exactly 2: the front part first, then the back part.");
        var front = targetTransform(targets[0]).opacity, back = targetTransform(targets[1]).opacity;
        front.expression = ZER.showExpr(o.look, o.axis, true, o.threshold);
        back.expression = ZER.showExpr(o.look, o.axis, false, o.threshold);
    };

    // ------------------------------------------------------------------
    // EYE GENERATOR
    // One "Base" path (corner to corner) drives the eye white, the lid
    // line, the clipped pupil and the lashes. Reshape or keyframe Base.
    // ------------------------------------------------------------------

    function addGroup(contents, name) {
        var g = contents.addProperty("ADBE Vector Group");
        g.name = name;
        return g;
    }

    function rootContents(layer) { return layer.property("ADBE Root Vectors Group"); }

    // Re-fetches a group by name path (adding shape items invalidates older references).
    function grp(layer, names) {
        var c = rootContents(layer), g = null;
        for (var i = 0; i < names.length; i++) {
            g = c.property(names[i]);
            c = g.property("ADBE Vectors Group");
        }
        return g;
    }
    function contentsOf(layer, names) { return names.length ? grp(layer, names).property("ADBE Vectors Group") : rootContents(layer); }

    function makeShape(v, inT, outT, closed) {
        var s = new Shape(); s.vertices = v; s.inTangents = inT; s.outTangents = outT; s.closed = closed; return s;
    }

    function addPath(layer, at, name, shape) {
        var p = contentsOf(layer, at).addProperty("ADBE Vector Shape - Group");
        p.name = name;
        if (shape) p.property("ADBE Vector Shape").setValue(shape);
    }
    function addFill(layer, at, color) {
        contentsOf(layer, at).addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(color);
    }
    function addStroke(layer, at, color, width) {
        var s = contentsOf(layer, at).addProperty("ADBE Vector Graphic - Stroke");
        s.property("ADBE Vector Stroke Color").setValue(color);
        s.property("ADBE Vector Stroke Width").setValue(width);
        s.property("ADBE Vector Stroke Line Cap").setValue(2); // round
    }

    function uniqueGroupName(layer, base) {
        var name = base, n = 2;
        while (rootContents(layer).property(name)) name = base + " " + n++;
        return name;
    }

    ZER.eyeExpr = {
        white: function (eye, ctrl) {
            return [
                "// Zen Easy Rig - eye white",
                "ctrl   = thisComp.layer(" + q(ctrl) + ");",
                "open   = ctrl.effect(\"Eye Opening\")(\"Slider\");      // height in px",
                "top    = ctrl.effect(\"Top Lid\")(\"Slider\") / 100;     // 100 = open, 0 = closed",
                "bottom = ctrl.effect(\"Bottom Lid\")(\"Slider\") / 100;",
                "round  = ctrl.effect(\"Roundness\")(\"Slider\");",
                "",
                "base = content(" + q(eye) + ").content(\"Base\").content(\"Base Path\").path;",
                "L = base.pointOnPath(0);    // inner / outer corners",
                "R = base.pointOnPath(1);",
                "M = base.pointOnPath(0.5);  // middle of the eye",
                "N = base.normalOnPath(0.5); // points down",
                "T = base.tangentOnPath(0.5) * round;   // handle along the eye",
                "B = T * -1;                            // same handle, backwards",
                "",
                "up   = M - N * open / 2 * top;      // half the opening above the middle",
                "down = M + N * open / 2 * bottom;   // half below",
                "createPath([L, down, R, up], [[0,0], B, [0,0], T], [[0,0], T, [0,0], B], true);"
            ].join("\n");
        },
        lid: function (eye, ctrl) {
            return [
                "// Zen Easy Rig - upper lid line (same top as the eye white)",
                "ctrl  = thisComp.layer(" + q(ctrl) + ");",
                "open  = ctrl.effect(\"Eye Opening\")(\"Slider\");",
                "top   = ctrl.effect(\"Top Lid\")(\"Slider\") / 100;",
                "round = ctrl.effect(\"Roundness\")(\"Slider\");",
                "",
                "base = content(" + q(eye) + ").content(\"Base\").content(\"Base Path\").path;",
                "L = base.pointOnPath(0);",
                "R = base.pointOnPath(1);",
                "up = base.pointOnPath(0.5) - base.normalOnPath(0.5) * open / 2 * top;",
                "T = base.tangentOnPath(0.5) * round;",
                "createPath([L, up, R], [[0,0], T * -1, [0,0]], [[0,0], T, [0,0]], false);"
            ].join("\n");
        },
        clip: function (eye) {
            return "// the pupil is cut to the eye white's shape\ncontent(" + q(eye) + ").content(\"White\").content(\"White Path\").path;";
        },
        // side: 1 = left eye, -1 = right eye, 0 = a single eye (no convergence)
        pupilPos: function (ctrl, look, side) {
            return [
                "// Zen Easy Rig - pupil",
                "ctrl = thisComp.layer(" + q(ctrl) + ");",
                "side = " + (side || 0) + ";   // 1 = left eye, -1 = right eye",
                "move = ctrl.effect(\"Pupils\")(\"Point\");   // move the pupils by hand",
                "try { look = thisComp.layer(" + q(look || "CTRL Look") + ").transform.position; } catch (e) { look = [0, 0]; }   // no Look control = no follow",
                "follow = ctrl.effect(\"Pupil Follow\")(\"Slider\");   // how far the pupils follow the look",
                "conv = ctrl.effect(\"Convergence\")(\"Slider\") * side;   // + = pupils closer (cross-eyed), - = further apart",
                "value + move + look * follow + [conv, 0];"
            ].join("\n");
        },
        pupilSize: function (ctrl) {
            return "s = thisComp.layer(" + q(ctrl) + ").effect(\"Pupil Size\")(\"Slider\");\n[s, s];";
        },
        lashPos: function (eye, progress) {
            return [
                "// Zen Easy Rig - lash sits on the lid line",
                "progress = " + num(progress) + ";   // 0 = first corner, 1 = other corner",
                "lid = content(" + q(eye) + ").content(\"Lid\").content(\"Lid Path\").path;",
                "lid.pointOnPath(progress);"
            ].join("\n");
        },
        lashRot: function (eye, progress) {
            return [
                "// Zen Easy Rig - lash follows the lid's angle",
                "progress = " + num(progress) + ";",
                "lid = content(" + q(eye) + ").content(\"Lid\").content(\"Lid Path\").path;",
                "t = lid.tangentOnPath(progress);",
                "value + radiansToDegrees(Math.atan2(t[1], t[0]));"
            ].join("\n");
        }
    };

    // Controls that can exist once per eye ("Top Lid L", "Top Lid R"...). Convergence always stays shared.
    var PER_EYE = ["Eye Opening", "Top Lid", "Bottom Lid", "Roundness", "Pupil Size", "Pupil Follow", "Pupils", "Eye Open"];
    // Points an eye expression at that eye's own controls: effect("Top Lid") -> effect("Top Lid L").
    function perEye(text, sfx) {
        if (!sfx) return text;
        for (var i = 0; i < PER_EYE.length; i++) text = text.split("effect(\"" + PER_EYE[i] + "\")").join("effect(\"" + PER_EYE[i] + sfx + "\")");
        return text;
    }

    // "Pupils" point control: moves the pupils directly (rests at [0,0]).
    function addPupilPoint(ctrl, sfx) {
        var fx = ctrl.property("ADBE Effect Parade"), name = "Pupils" + (sfx || "");
        if (fx.property(name)) return;
        var p = fx.addProperty("ADBE Point Control");
        p.name = name;
        p.property(1).setValue([0, 0]);
    }

    // sfx: "" for controls shared by both eyes, " L" / " R" for one eye's own controls
    function addEyeControls(ctrl, w, sfx) {
        sfx = sfx || "";
        addPupilPoint(ctrl, sfx);
        var fx = ctrl.property("ADBE Effect Parade");
        var list = [["Eye Opening", w * 0.6], ["Top Lid", 100], ["Bottom Lid", 100], ["Roundness", w * 0.25], ["Pupil Size", w * 0.38], ["Pupil Follow", 0.4], ["Convergence", 0]];
        for (var i = 0; i < list.length; i++) {
            var name = list[i][0] === "Convergence" ? "Convergence" : list[i][0] + sfx;
            if (fx.property(name)) continue;
            var s = fx.addProperty("ADBE Slider Control");
            s.name = name;
            s.property(1).setValue(list[i][1]);
        }
    }

    // " L" for "Eye L", " R" for "Eye R", " 3" for "Eye 3", "" for a lone "Eye"
    function eyeSuffix(name) { var m = name.match(/^Eye (.+)$/); return m ? " " + m[1] : ""; }

    // Builds one eye group inside a shape layer.
    function buildEye(layer, name, center, w, lashes, ctrlName, lookName, baseShape, side, sfx) {
        var eye = uniqueGroupName(layer, name);
        addGroup(rootContents(layer), eye);
        grp(layer, [eye]).property("ADBE Vector Transform Group").property("ADBE Vector Position").setValue(center);

        var dark = [0.12, 0.1, 0.12], i;
        // top of the stack first. The lid line only comes with lashes.
        if (lashes > 0) {
            addGroup(contentsOf(layer, [eye]), "Lid");
            addPath(layer, [eye, "Lid"], "Lid Path");
            addStroke(layer, [eye, "Lid"], dark, Math.max(2, w * 0.05));
        }

        var progress = [];
        for (i = 0; i < lashes; i++) {
            progress.push(lashes === 1 ? 0.5 : 0.2 + 0.6 * i / (lashes - 1));
            var ln = "Lash " + (i + 1), len = w * 0.14;
            addGroup(contentsOf(layer, [eye]), ln);
            // straight, but with real bezier handles (along the line) ready to bend
            addPath(layer, [eye, ln], "Lash Path", makeShape([[0, 0], [0, -len]], [[0, 0], [0, len / 3]], [[0, -len / 3], [0, 0]], false));
            addStroke(layer, [eye, ln], dark, Math.max(1.5, w * 0.035));
        }

        addGroup(contentsOf(layer, [eye]), "Pupil");
        addGroup(contentsOf(layer, [eye, "Pupil"]), "Pupil Dot");
        contentsOf(layer, [eye, "Pupil", "Pupil Dot"]).addProperty("ADBE Vector Shape - Ellipse");
        addPath(layer, [eye, "Pupil"], "Clip");
        contentsOf(layer, [eye, "Pupil"]).addProperty("ADBE Vector Filter - Merge").property("ADBE Vector Merge Type").setValue(4); // Intersect
        addFill(layer, [eye, "Pupil"], dark);

        addGroup(contentsOf(layer, [eye]), "White");
        addPath(layer, [eye, "White"], "White Path");
        addFill(layer, [eye, "White"], [1, 1, 1]);

        addGroup(contentsOf(layer, [eye]), "Base");
        addPath(layer, [eye, "Base"], "Base Path",
            baseShape || makeShape([[-w / 2, 0], [w / 2, 0]], [[0, 0], [-w * 0.3, -w * 0.08]], [[w * 0.3, -w * 0.08], [0, 0]], false));

        // expressions, now that everything exists
        var E = ZER.eyeExpr;
        grp(layer, [eye, "White"]).property("ADBE Vectors Group").property("White Path").property("ADBE Vector Shape").expression = perEye(E.white(eye, ctrlName), sfx);
        if (lashes > 0) grp(layer, [eye, "Lid"]).property("ADBE Vectors Group").property("Lid Path").property("ADBE Vector Shape").expression = perEye(E.lid(eye, ctrlName), sfx);
        grp(layer, [eye, "Pupil"]).property("ADBE Vectors Group").property("Clip").property("ADBE Vector Shape").expression = E.clip(eye);
        var dot = grp(layer, [eye, "Pupil", "Pupil Dot"]);
        dot.property("ADBE Vector Transform Group").property("ADBE Vector Position").expression = perEye(E.pupilPos(ctrlName, lookName, side), sfx);
        grp(layer, [eye, "Pupil", "Pupil Dot"]).property("ADBE Vectors Group").property(1).property("ADBE Vector Ellipse Size").expression = perEye(E.pupilSize(ctrlName), sfx);
        for (i = 0; i < lashes; i++) {
            var tr = grp(layer, [eye, "Lash " + (i + 1)]).property("ADBE Vector Transform Group");
            tr.property("ADBE Vector Position").expression = E.lashPos(eye, progress[i]);
            grp(layer, [eye, "Lash " + (i + 1)]).property("ADBE Vector Transform Group").property("ADBE Vector Rotation").expression = E.lashRot(eye, progress[i]);
        }
        return eye;
    }

    // o: { width, gap, lashes, both, intoLayer (shape layer or null), ctrlType }
    // A drawn 2-point line becomes an eye's Base path. Returns { layer, center, width, shape }
    // and switches the drawn line off (not deleted). The line is read at the current time.
    ZER.eyeLineFromPath = function (pathProp) {
        var sh = pathProp.value, v = sh.vertices, inT = sh.inTangents, outT = sh.outTangents, n = v.length, i;
        if (n < 2) throw new Error("\"" + pathProp.parentProperty.name + "\" needs at least 2 points (corner to corner).");
        if (v[0][0] > v[n - 1][0]) { // always left -> right, so "up" is the top lid
            var rv = [], ri = [], ro = [];
            for (i = n - 1; i >= 0; i--) { rv.push(v[i]); ri.push(outT[i]); ro.push(inT[i]); }
            v = rv; inT = ri; outT = ro;
        }
        // offset of the groups the line sits in (their position - anchor)
        var off = [0, 0], g = pathProp.parentProperty.parentProperty;
        while (g && g.propertyDepth > 1) {
            if (g.matchName === "ADBE Vector Group") {
                var tr = g.property("ADBE Vector Transform Group");
                var p = tr.property("ADBE Vector Position").value, a = tr.property("ADBE Vector Anchor").value;
                off = [off[0] + p[0] - a[0], off[1] + p[1] - a[1]];
            }
            g = g.parentProperty;
        }
        var c = [(v[0][0] + v[n - 1][0]) / 2, (v[0][1] + v[n - 1][1]) / 2];
        var local = [];
        for (i = 0; i < n; i++) local.push([v[i][0] - c[0], v[i][1] - c[1]]);
        var shape = makeShape(local, inT, outT, false);
        var layer = layerOf(pathProp);
        pathProp.parentProperty.enabled = false;
        return { layer: layer, center: [c[0] + off[0], c[1] + off[1]], width: dist(v[0], v[n - 1]), shape: shape };
    };

    ZER.createEyes = function (comp, o) {
        if (!(comp instanceof CompItem)) throw new Error("Open a composition first.");
        var w = o.width, look = layerByName(comp, "CTRL Look") ? "CTRL Look" : null;
        var head = layerByName(comp, "CTRL Head");

        // eye sliders go on CTRL Eyes if it exists, otherwise on CTRL Look, otherwise a new CTRL Eyes
        var ctrl = layerByName(comp, "CTRL Eyes") || layerByName(comp, "CTRL Look");
        if (!ctrl) {
            var p = head ? worldPoint(comp, head) : [comp.width / 2, comp.height / 2];
            ctrl = ZER.makeController(comp, "CTRL Eyes", o.ctrlType, [p[0], p[1] - w], 50);
            if (head) ctrl.parent = head;
        }
        // one shared set of eye sliders, or (perEye) one set per eye, made as each eye is built
        if (!o.perEye) addEyeControls(ctrl, w, "");
        function eye(layerX, nm, center, width, shape, side) {
            var sfx = o.perEye ? eyeSuffix(nm) : "";
            if (o.perEye) addEyeControls(ctrl, width, sfx);
            return buildEye(layerX, nm, center, width, o.lashes, ctrl.name, look, shape, side, sfx);
        }

        var layer = o.intoLayer, made = [];
        if (!layer && !(o.lines && o.lines.length)) {
            layer = comp.layers.addShape();
            layer.name = uniqueName(comp, "Eyes");
            layer.transform.anchorPoint.setValue([0, 0]);
            var c = head ? worldPoint(comp, head) : [comp.width / 2, comp.height / 2];
            layer.transform.position.setValue([c[0], c[1]]);
            if (head) layer.parent = head;
        }
        if (o.lines && o.lines.length) {
            // one eye per drawn line, built around it; leftmost line = Eye L
            var lines = o.lines.slice(0).sort(function (a, b) { return a.center[0] - b.center[0]; });
            for (var i = 0; i < lines.length; i++) {
                var nm = lines.length === 1 ? "Eye" : (i === 0 ? "Eye L" : (i === 1 ? "Eye R" : "Eye " + (i + 1)));
                var sd = lines.length === 1 ? 0 : (i === 0 ? 1 : (i === lines.length - 1 ? -1 : 0));
                made.push(eye(lines[i].layer, nm, lines[i].center, lines[i].width, lines[i].shape, sd));
            }
            return { layer: lines[0].layer, ctrl: ctrl, eyes: made };
        }

        var off = o.both ? (w + o.gap) / 2 : 0;
        made.push(eye(layer, o.both ? "Eye L" : "Eye", [-off, 0], w, null, o.both ? 1 : 0));
        if (o.both) made.push(eye(layer, "Eye R", [off, 0], w, null, -1));
        return { layer: layer, ctrl: ctrl, eyes: made };
    };

    // ------------------------------------------------------------------
    // EXTRAS
    // ------------------------------------------------------------------

    // Delay: the layer follows its parent a few frames late (drag / overlap).
    ZER.delayExpr = function (frames) {
        return [
            "// Zen Easy Rig - delay: follow the parent a little late",
            "frames = " + num(frames) + ";   // how many frames behind",
            "delay = frames * thisComp.frameDuration;   // = frames / fps",
            "p = toWorld(anchorPoint, time - delay);",
            "hasParent ? parent.fromWorld(p) : p;"
        ].join("\n");
    };

    ZER.applyDelay = function (comp, layers, frames) {
        if (!layers.length) throw new Error("Select the layers that should lag behind.");
        for (var i = 0; i < layers.length; i++) layers[i].transform.position.expression = ZER.delayExpr(frames);
    };

    // Ignore parent rotation: the layer keeps its own angle while its parent turns.
    ZER.ignoreRotationExpr = function () {
        return [
            "// Zen Easy Rig - ignore parent rotation (this layer's own Rotation keyframes still work)",
            "L = thisLayer;",
            "u = L.hasParent ? L.parent.toWorldVec([1,0]) : [1,0];   // the parents' total rotation",
            "value - radiansToDegrees(Math.atan2(u[1], u[0]));"
        ].join("\n");
    };

    ZER.applyIgnoreRotation = function (comp, layers) {
        if (!layers.length) throw new Error("Select the layers that should ignore their parent's rotation.");
        for (var i = 0; i < layers.length; i++) {
            if (layers[i].threeDLayer) throw new Error("\"" + layers[i].name + "\" is 3D. This works on 2D layers.");
            layers[i].transform.rotation.expression = ZER.ignoreRotationExpr();
        }
    };

    // Morph: a slider picks a pose from a property's keyframes (like Boca in 01_FacialRig).
    // 0 = first keyframe, 1 = second... in-between numbers blend through the animation between them.
    ZER.morphExpr = function (ctrlRef, sliderName) {
        return [
            "// Zen Easy Rig - morph: the slider picks a pose from this property's keyframes",
            "pose = " + ctrlRef + ".effect(" + q(sliderName) + ")(\"Slider\");   // 0 = first keyframe, 1 = second, 2 = third...",
            "n = numKeys;",
            "if (n < 2) { value; } else {",
            "  p = clamp(pose, 0, n - 1);",
            "  i = Math.min(Math.floor(p), n - 2);   // the pose just before (0-based)",
            "  valueAtTime(linear(p, i, i + 1, key(i + 1).time, key(i + 2).time));",
            "}"
        ].join("\n");
    };

    // Has this layer (or a group above the property) been set up by the face tool?
    function isFacePart(prop) {
        var L = layerOf(prop), t = L.transform;
        var list = [t.position, t.scale, t.rotation, t.opacity];
        for (var g = prop.parentProperty; g && g.propertyDepth > 0; g = g.parentProperty) {
            if (g.matchName === "ADBE Vector Group") {
                var tr = g.property("ADBE Vector Transform Group");
                list.push(tr.property("ADBE Vector Position"), tr.property("ADBE Vector Scale"), tr.property("ADBE Vector Rotation"), tr.property("ADBE Vector Group Opacity"));
            }
        }
        for (var i = 0; i < list.length; i++) if (isFaceExpr(list[i].expression)) return true;
        return false;
    }

    // Builds pose or time morphs. kind: "pose" or "time".
    // separate = false: ONE shared slider for everything selected; true: one slider per property.
    // Where a slider goes: CTRL Look if a face part is involved, the layer itself if all its
    // properties are on one layer, otherwise a new CTRL Morph.
    function makeMorphs(comp, props, lookName, ctrlType, kind, separate) {
        var list = [], i;
        for (i = 0; i < props.length; i++) if (props[i].propertyType === PropertyType.PROPERTY && props[i].canSetExpression && (props[i].numKeys > 0 || kind === "pose")) list.push(props[i]);
        if (!list.length) throw new Error(kind === "pose" ? "Select a property with pose keyframes (e.g. a mouth Path)." : "Select keyframed properties (or their keyframes), on one or more layers.");
        if (kind === "pose") for (i = 0; i < list.length; i++) if (list[i].numKeys < 2) throw new Error("\"" + list[i].name + "\" needs 2 or more keyframes (one per pose).");
        // remember everything by index path (adding layers / effects can invalidate references)
        var refs = [];
        for (i = 0; i < list.length; i++) {
            var path = [], p2 = list[i];
            while (p2.propertyDepth > 0) { path.unshift(p2.propertyIndex); p2 = p2.parentProperty; }
            var label = layerOf(list[i]).name;   // a readable name: the group it sits in, or the layer
            for (var g = list[i].parentProperty; g && g.propertyDepth > 0; g = g.parentProperty) if (g.matchName === "ADBE Vector Group") { label = g.name; break; }
            var pn = list[i].name === "Path" ? "" : list[i].name;   // "Rotation", "Opacity"... (a Path is named by its group)
            refs.push({ layer: layerOf(list[i]), path: path, face: isFacePart(list[i]), label: label, prop: pn, t0: list[i].keyTime(1), t1: list[i].keyTime(list[i].numKeys) });
        }
        var sets = [];
        if (separate) for (i = 0; i < refs.length; i++) sets.push([refs[i]]);
        else sets.push(refs);
        var made = [];
        for (var s = 0; s < sets.length; s++) {
            var set = sets[s], anyFace = false, oneLayer = true, t0 = Infinity, t1 = -Infinity;
            for (i = 0; i < set.length; i++) {
                if (set[i].face) anyFace = true;
                if (set[i].layer.index !== set[0].layer.index) oneLayer = false;
                t0 = Math.min(t0, set[i].t0); t1 = Math.max(t1, set[i].t1);
            }
            var host = anyFace ? layerByName(comp, lookName) : null;
            if (!host && oneLayer) host = set[0].layer;
            var newCtrl = false;
            if (!host) { var p = worldPoint(comp, set[0].layer); host = ZER.makeController(comp, "CTRL Morph", ctrlType, [p[0], p[1] - 100], 60); newCtrl = true; }
            // readable slider names: what it drives, e.g. "Morph Teeth Rotation" or "Morph Time Mouth"
            var what = [];
            for (i = 0; i < set.length; i++) {
                var bits = [];
                if (!(host.index === set[i].layer.index && set.length === 1 && set[i].prop)) bits.push(set[i].label);   // the layer name is redundant on its own layer
                if (set[i].prop && set.length === 1) bits.push(set[i].prop);
                var w = bits.join(" ");
                var seen = false; for (var k2 = 0; k2 < what.length; k2++) if (what[k2] === w) seen = true;
                if (w && !seen) what.push(w);
            }
            var label2 = what.join(" + ");
            if (label2.length > 24) label2 = what[0] + " + " + (what.length - 1) + " more";
            var base = (kind === "pose" ? "Morph" : "Morph Time") + (label2 ? " " + label2 : "");
            if (newCtrl && label2) host.name = uniqueName(comp, "CTRL Morph " + label2);   // e.g. "CTRL Morph Teeth + Tongue"
            var fx = host.property("ADBE Effect Parade"), name = base, n = 2;
            while (fx.property(name)) name = base + " " + n++;
            var sl = fx.addProperty("ADBE Slider Control"); sl.name = name; sl.property(1).setValue(0);
            for (i = 0; i < set.length; i++) {
                var t = set[i].layer;
                for (var j = 0; j < set[i].path.length; j++) t = t.property(set[i].path[j]);
                var ref = host.index === set[i].layer.index ? "thisLayer" : "thisComp.layer(" + q(host.name) + ")";
                t.expression = kind === "pose" ? ZER.morphExpr(ref, name) : ZER.morphTimeExpr(ref, name, t0 / comp.frameDuration, t1 / comp.frameDuration);
            }
            made.push(host.name + " > " + name);
        }
        return made;
    }

    // Morph (time based): the slider plays the animations together. It runs 0 - 100 (AE's default
    // slider range) over the selected keyframes: 0 = the first keyframe, 100 = the last one.
    // (Scripts can't change a slider's range in AE, so the expression maps it instead.)
    ZER.morphTimeExpr = function (ctrlRef, sliderName, startFrame, endFrame) {
        return [
            "// Zen Easy Rig - morph (time): the slider scrubs every linked animation together",
            "pct = " + ctrlRef + ".effect(" + q(sliderName) + ")(\"Slider\");   // 0 = first keyframe, 100 = last keyframe",
            "start = " + num(startFrame) + ";  end = " + num(endFrame) + ";   // frames covered by the keyframes",
            "frame = linear(pct, 0, 100, start, end);",
            "valueAtTime(framesToTime(frame));"
        ].join("\n");
    };

    // Pose morph: returns a list of "host > slider".
    ZER.createMorph = function (comp, props, lookName, separate, ctrlType) {
        return makeMorphs(comp, props, lookName, ctrlType || "Null", "pose", !!separate);
    };

    // Time based morph: returns "host > slider" (several, comma separated, when separate).
    ZER.createTimeMorph = function (comp, props, lookName, ctrlType, separate) {
        return makeMorphs(comp, props, lookName, ctrlType || "Null", "time", !!separate).join(", ");
    };

    // Remove morph: takes the morph expressions off the selected properties (or every property
    // of the selected layers) so you can edit the keyframes, then re-create the morph.
    // A Morph slider nothing uses any more is deleted, and so is an empty CTRL Morph.
    function eachProp(group, fn) {
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.propertyType === PropertyType.PROPERTY) fn(p); else eachProp(p, fn);
        }
    }

    ZER.removeMorph = function (comp, props, layers) {
        var targets = [], i;
        for (i = 0; i < props.length; i++) if (props[i].propertyType === PropertyType.PROPERTY) targets.push(props[i]);
        if (!targets.length) for (i = 0; i < layers.length; i++) eachProp(layers[i], function (p) { targets.push(p); });
        var sliders = {}, removed = 0;
        for (i = 0; i < targets.length; i++) {
            var e = "";
            try { e = targets[i].expression; } catch (x) { continue; }
            if (e.indexOf("// Zen Easy Rig - morph") !== 0) continue;
            var m = e.match(/(thisComp\.layer\("([^"]*)"\)|thisLayer)\.effect\("([^"]*)"\)/);
            if (m) sliders[(m[2] || layerOf(targets[i]).name) + "\u0001" + m[3]] = true;
            targets[i].expression = "";
            removed++;
        }
        if (!removed) throw new Error("No morph expressions found on the selection.");
        // delete sliders no other expression still uses
        var users = [];
        for (var l = 1; l <= comp.numLayers; l++) eachProp(comp.layer(l), function (p) { try { if (p.expression.indexOf("// Zen Easy Rig - morph") === 0) users.push({ layer: layerOf(p).name, text: p.expression }); } catch (x) {} });
        for (var key in sliders) {
            var host = key.split("\u0001")[0], name = key.split("\u0001")[1], used = false;
            for (var u = 0; u < users.length; u++) {
                var t = users[u].text;
                if (t.indexOf("effect(" + q(name) + ")") < 0) continue;
                if (t.indexOf("thisComp.layer(" + q(host) + ")") >= 0 || (t.indexOf("thisLayer.effect") >= 0 && users[u].layer === host)) used = true;
            }
            var hl = layerByName(comp, host);
            if (!used && hl && hl.property("ADBE Effect Parade").property(name)) {
                hl.property("ADBE Effect Parade").property(name).remove();
                if (hl.name.indexOf("CTRL Morph") === 0 && hl.property("ADBE Effect Parade").numProperties === 0) {
                    var src = hl.source; hl.remove(); if (src && src.usedIn.length === 0) src.remove();
                }
            }
        }
        return removed;
    };

    // Simple parent (from AeScripts/SimpleParent.jsx and SimpleParent_Unparented.jsx):
    // every selected layer is parented to the LAST selected one.
    // onlyUnparented: leave layers that already have a parent alone.
    ZER.parentToLast = function (comp, layers, onlyUnparented) {
        if (layers.length < 2) throw new Error("Select at least two layers: the children first, the parent last.");
        var parent = layers[layers.length - 1], n = 0;
        for (var i = 0; i < layers.length - 1; i++) {
            if (onlyUnparented && layers[i].parent) continue;
            layers[i].parent = parent;
            n++;
        }
        return n;
    };

    // Copy / paste expression controls.
    // Copy remembers the controls of a layer (or just the selected ones). Paste creates the same controls
    // on another layer and links the OLD ones to the new ones, so everything that used the old controls
    // is now driven from the new layer.
    var CONTROL_TYPES = {
        "ADBE Slider Control": 1, "ADBE Point Control": 1, "ADBE Point3D Control": 1, "ADBE Angle Control": 1,
        "ADBE Checkbox Control": 1, "ADBE Color Control": 1, "ADBE Layer Control": 1
    };

    // layers: one or more source layers. selectedProps: if some controls are selected, only those are copied.
    ZER.copyControls = function (comp, layers, selectedProps) {
        if (layers && layers.matchName) layers = [layers];   // a single layer is fine too
        if (!layers || !layers.length) throw new Error("Select the layer(s) that have the controls.");
        var clip = { compId: comp.id, sources: [], count: 0 }, i, j;
        for (j = 0; j < layers.length; j++) {
            var layer = layers[j], fx = layer.property("ADBE Effect Parade"), picked = [];
            for (i = 0; i < selectedProps.length; i++) {
                var p = selectedProps[i];
                if (p.parentProperty && p.parentProperty.matchName === "ADBE Effect Parade" && CONTROL_TYPES[p.matchName] && layerOf(p) === layer) picked.push(p.propertyIndex);
            }
            if (!picked.length) for (i = 1; i <= fx.numProperties; i++) if (CONTROL_TYPES[fx.property(i).matchName]) picked.push(i);
            if (!picked.length) continue;
            var lid = null; try { lid = layer.id; } catch (x) {}
            var src = { layerId: lid, layerName: layer.name, controls: [] };
            for (i = 0; i < picked.length; i++) {
                var e = fx.property(picked[i]), v = e.property(1), keys = [];
                for (var k = 1; k <= v.numKeys; k++) keys.push({ t: v.keyTime(k), v: v.keyValue(k) });
                src.controls.push({ name: e.name, matchName: e.matchName, param: v.name, value: v.value, keys: keys, expression: v.expression, expressionEnabled: v.expressionEnabled });
            }
            clip.sources.push(src);
            clip.count += src.controls.length;
        }
        if (!clip.count) throw new Error("No expression controls found (Slider, Point, Angle, Checkbox, Color, Layer).");
        ZER.clipboard = clip;
        return clip;
    };

    // Pastes everything copied onto ONE layer and links each old control to its new copy.
    ZER.pasteControls = function (comp, target) {
        var clip = ZER.clipboard;
        if (!clip) throw new Error("Nothing copied yet. Select layers with controls and click Copy first.");
        if (!target) throw new Error("Select the layer to paste the controls on.");
        var srcComp = app.project.itemByID(clip.compId);
        // how the old layers' expressions find the new layer
        var targetRef = (srcComp === comp ? "thisComp" : "comp(" + q(comp.name) + ")") + ".layer(" + q(target.name) + ")";
        var made = [], s, i;
        for (s = 0; s < clip.sources.length; s++) {
            var S = clip.sources[s], src = null;
            if (srcComp) for (var L = 1; L <= srcComp.numLayers && !src; L++) {   // find the copied layer again (by id, or by name)
                var cand = srcComp.layer(L), cid = null;
                try { cid = cand.id; } catch (x) {}
                if ((S.layerId !== null && cid === S.layerId) || (S.layerId === null && cand.name === S.layerName)) src = cand;
            }
            if (!src) throw new Error("The copied layer \"" + S.layerName + "\" can't be found any more. Copy again.");
            if (src === target) throw new Error("\"" + target.name + "\" is one of the copied layers. Paste on a different layer.");
            for (i = 0; i < S.controls.length; i++) {
                var c = S.controls[i], fx = target.property("ADBE Effect Parade");
                var name = c.name, n = 2;
                while (fx.property(name)) name = c.name + " " + n++;
                fx.addProperty(c.matchName).name = name;
                var v = target.property("ADBE Effect Parade").property(name).property(1);
                if (c.keys.length) for (var k = 0; k < c.keys.length; k++) v.setValueAtTime(c.keys[k].t, c.keys[k].v);
                else if (c.matchName !== "ADBE Layer Control" || srcComp === comp) { try { v.setValue(c.value); } catch (x2) {} }
                if (c.expression) { v.expression = c.expression; v.expressionEnabled = c.expressionEnabled; }
                // reroute: the old control now just reads the new one
                var old = src.property("ADBE Effect Parade").property(c.name);
                if (old) old.property(1).expression = "// Zen Easy Rig - linked to the pasted control\n" + targetRef + ".effect(" + q(name) + ")(" + q(c.param) + ");";
                made.push({ from: S.layerName + " > " + c.name, to: name, param: c.param });
            }
        }
        return made;
    };

    // Fan rig: one controller, two angles. "Fan" spreads the layers apart,
    // "Rotate" turns them all by the same amount (fingers, feathers, petals...).
    // ctrl = controller layer name, or null when the controls sit on this same layer (shape groups)
    ZER.fanExpr = function (ctrl, index, count, fromCenter, fanName, rotName) {
        fanName = fanName || "Fan"; rotName = rotName || "Rotate";
        return [
            "// Zen Easy Rig - fan",
            ctrl ? "ctrl = thisComp.layer(" + q(ctrl) + ");" : "ctrl = thisLayer;   // the Fan / Rotate controls are on this layer",
            "i = " + index + ";  n = " + count + ";   // this layer's place in the fan (0 = first)",
            fromCenter ? "step = i - (n - 1) / 2;   // the middle layer stays, the outer ones spread most"
                       : "step = i;   // the first layer stays, the last one spreads most",
            "",
            "fan = ctrl.effect(" + q(fanName) + ")(\"Angle\");      // degrees between neighbours",
            "add = ctrl.effect(" + q(rotName) + ")(\"Angle\");   // added to all of them",
            "value + add + fan * step;"
        ].join("\n");
    };

    // Shape groups (all in one shape layer): the controls go on that layer.
    ZER.createGroupFan = function (comp, groups, o) {
        if (groups.length < 2) throw new Error("Select 2 or more groups, in the order they fan out.");
        var layer = layerOf(groups[0]);
        for (var i = 1; i < groups.length; i++) if (layerOf(groups[i]) !== layer) throw new Error("Pick groups from one shape layer at a time.");
        // remember where the groups are (adding effects makes old references invalid)
        var paths = [];
        for (i = 0; i < groups.length; i++) {
            var path = [], g = groups[i];
            while (g.propertyDepth > 1) { if (g.matchName === "ADBE Vector Group") path.unshift(g.propertyIndex); g = g.parentProperty; }
            paths.push(path);
        }
        var fx = layer.property("ADBE Effect Parade"), n = 1, fanName = "Fan", rotName = "Rotate";
        while (fx.property(fanName) || fx.property(rotName)) { n++; fanName = "Fan " + n; rotName = "Rotate " + n; }
        fx.addProperty("ADBE Angle Control").name = fanName;
        layer.property("ADBE Effect Parade").addProperty("ADBE Angle Control").name = rotName;
        for (i = 0; i < paths.length; i++) {
            var c = rootContents(layer), grpI = null;
            for (var k = 0; k < paths[i].length; k++) { grpI = c.property(paths[i][k]); c = grpI.property("ADBE Vectors Group"); }
            grpI.property("ADBE Vector Transform Group").property("ADBE Vector Rotation").expression = ZER.fanExpr(null, i, paths.length, o.fromCenter, fanName, rotName);
        }
        return layer;
    };

    ZER.createFan = function (comp, layers, o) {
        if (layers.length < 2) throw new Error("Select 2 or more layers, in the order they fan out (e.g. finger 1 to finger 5).");
        var p = worldPoint(comp, layers[0]);
        var ctrl = ZER.makeController(comp, "CTRL Fan " + layers[0].name, o.ctrlType, [p[0], p[1] - 80], 60);
        var fx = ctrl.property("ADBE Effect Parade");
        fx.addProperty("ADBE Angle Control").name = "Fan";
        fx.addProperty("ADBE Angle Control").name = "Rotate";
        for (var i = 0; i < layers.length; i++) layers[i].transform.rotation.expression = ZER.fanExpr(ctrl.name, i, layers.length, o.fromCenter);
        return ctrl;
    };

    // ------------------------------------------------------------------
    // SIMPLE EYES
    // Turns a drawn eye (a shape layer, or a group inside one) into a
    // rounded rectangle of the same size and colour that can blink,
    // with an optional pupil. The original drawing is switched off, not deleted.
    // ------------------------------------------------------------------

    function findColor(group) {
        var stroke = null;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === "ADBE Vector Graphic - Fill" && p.enabled) return p.property("ADBE Vector Fill Color").value;
            if (p.matchName === "ADBE Vector Graphic - Stroke" && p.enabled && !stroke) stroke = p.property("ADBE Vector Stroke Color").value;
            if (p.propertyType !== PropertyType.PROPERTY) { var c = findColor(p); if (c) return c; }
        }
        return stroke;
    }

    // Bounds of a shape layer, or of one root group inside it (layer space).
    function shapeBounds(comp, layer, groupIndex) {
        if (!groupIndex) return layer.sourceRectAtTime(comp.time, false);
        var dup = layer.duplicate();
        var rc = rootContents(dup);
        for (var i = rc.numProperties; i >= 1; i--) if (i !== groupIndex) rc.property(i).remove();
        dup.enabled = true;
        var r = dup.sourceRectAtTime(comp.time, false);
        dup.remove();
        return r;
    }

    ZER.simpleEyeExpr = {
        size: function (ctrl, w, h) {
            return [
                "// Zen Easy Rig - simple eye",
                "open = thisComp.layer(" + q(ctrl) + ").effect(\"Eye Open\")(\"Slider\") / 100;   // 100 = open, 0 = closed",
                "w = " + num(w) + ";  h = " + num(h) + ";   // eye size when open",
                "[w, Math.max(h * open, w * 0.12)];   // never thinner than a line"
            ].join("\n");
        },
        round: function () {
            return "// fully rounded ends (a pill)\ns = thisProperty.propertyGroup(1).size;\nMath.min(s[0], s[1]) / 2;";
        }
    };

    // eyeGroup is the name of the new group at the root of the layer.
    function buildSimpleEye(comp, layer, eyeGroup, center, w, h, color, ctrl, look, pupil, pupilColor, side, sfx) {
        addGroup(rootContents(layer), eyeGroup);
        grp(layer, [eyeGroup]).property("ADBE Vector Transform Group").property("ADBE Vector Position").setValue(center);
        if (pupil) {
            addGroup(contentsOf(layer, [eyeGroup]), "Pupil");
            addGroup(contentsOf(layer, [eyeGroup, "Pupil"]), "Pupil Dot");
            contentsOf(layer, [eyeGroup, "Pupil", "Pupil Dot"]).addProperty("ADBE Vector Shape - Ellipse");
            contentsOf(layer, [eyeGroup, "Pupil"]).addProperty("ADBE Vector Shape - Rect").name = "Clip";
            contentsOf(layer, [eyeGroup, "Pupil"]).addProperty("ADBE Vector Filter - Merge").property("ADBE Vector Merge Type").setValue(4); // Intersect
            var dark = (color[0] + color[1] + color[2]) / 3 < 0.5;
            var pc = pupilColor ? [pupilColor[0], pupilColor[1], pupilColor[2]] : (dark ? [1, 1, 1] : [0.08, 0.08, 0.08]);
            addFill(layer, [eyeGroup, "Pupil"], pc);   // your drawn pupil's colour, if there was one
        }
        addGroup(contentsOf(layer, [eyeGroup]), "Eye Shape");
        contentsOf(layer, [eyeGroup, "Eye Shape"]).addProperty("ADBE Vector Shape - Rect").name = "Rect";
        addFill(layer, [eyeGroup, "Eye Shape"], [color[0], color[1], color[2]]);

        var E = ZER.simpleEyeExpr, ref = "content(" + q(eyeGroup) + ").content(\"Eye Shape\").content(\"Rect\")";
        function rect() { return contentsOf(layer, [eyeGroup, "Eye Shape"]).property("Rect"); }
        rect().property("ADBE Vector Rect Size").expression = perEye(E.size(ctrl, w, h), sfx);
        rect().property("ADBE Vector Rect Roundness").expression = E.round();
        rect().property("ADBE Vector Rect Position").expression = [
            "// where the eye closes: 0 = top, 0.5 = middle, 1 = bottom",
            "closeTo = 0.5;",
            "h = " + num(h) + ";   // height when open",
            "now = thisProperty.propertyGroup(1).size[1];   // height right now",
            "[0, (h - now) * (closeTo - 0.5)];"
        ].join("\n");
        if (pupil) {
            var clip = function () { return contentsOf(layer, [eyeGroup, "Pupil"]).property("Clip"); };
            clip().property("ADBE Vector Rect Size").expression = "// same shape as the eye, so the pupil stays inside\n" + ref + ".size;";
            clip().property("ADBE Vector Rect Position").expression = ref + ".position;";
            clip().property("ADBE Vector Rect Roundness").expression = ref + ".roundness;";
            var dot = function () { return grp(layer, [eyeGroup, "Pupil", "Pupil Dot"]); };
            dot().property("ADBE Vector Transform Group").property("ADBE Vector Position").expression = perEye(ZER.eyeExpr.pupilPos(ctrl, look, side), sfx);
            dot().property("ADBE Vectors Group").property(1).property("ADBE Vector Ellipse Size").expression = perEye(ZER.eyeExpr.pupilSize(ctrl), sfx);
        }
    }

    // targets: shape layers, or root groups of shape layers. o: { pupil, ctrlType }
    ZER.createSimpleEyes = function (comp, targets, o) {
        if (!(comp instanceof CompItem)) throw new Error("Open a composition first.");
        var items = [], i;
        for (i = 0; i < targets.length; i++) {
            var t = targets[i];
            if (t.matchName === "ADBE Vector Group") {
                if (t.propertyDepth !== 2) throw new Error("\"" + t.name + "\": pick a group at the top of the shape layer's Contents.");
                items.push({ layer: layerOf(t), index: t.propertyIndex, name: t.name });
            } else if (t.matchName === "ADBE Vector Layer") {
                // ONE layer holding exactly two groups = one group per eye.
                // With several layers selected, each layer is one eye (its groups can be eye + pupil).
                var rcT = rootContents(t), groupIdx = [];
                for (var gi = 1; gi <= rcT.numProperties; gi++) if (rcT.property(gi).matchName === "ADBE Vector Group") groupIdx.push(gi);
                if (groupIdx.length === 2 && targets.length === 1) {
                    for (var gk = 0; gk < 2; gk++) items.push({ layer: t, index: groupIdx[gk], name: rcT.property(groupIdx[gk]).name });
                } else items.push({ layer: t, index: 0, name: t.name });
            }
        }
        if (!items.length) throw new Error("Select the eye shape layers (or the eye groups inside a shape layer).");

        // measure everything before changing anything
        for (i = 0; i < items.length; i++) {
            var it = items[i];
            var b = shapeBounds(comp, it.layer, it.index);
            it.w = b.width; it.h = b.height; it.center = [b.left + b.width / 2, b.top + b.height / 2];
            var src = it.index ? rootContents(it.layer).property(it.index) : rootContents(it.layer);
            it.color = findColor(src) || [0, 0, 0];
            if (!it.index) {
                // whole layer with several groups: the biggest group is the eye, the next one the pupil
                var gs = [], rcI = rootContents(it.layer);
                for (var q2 = 1; q2 <= rcI.numProperties; q2++) if (rcI.property(q2).matchName === "ADBE Vector Group" && rcI.property(q2).enabled) gs.push(q2);
                if (gs.length >= 2) {
                    var sized = [];
                    for (var q3 = 0; q3 < gs.length; q3++) { var bb = shapeBounds(comp, it.layer, gs[q3]); sized.push({ i: gs[q3], area: bb.width * bb.height, size: Math.min(bb.width, bb.height) }); }
                    sized.sort(function (a, b) { return b.area - a.area; });
                    it.color = findColor(rootContents(it.layer).property(sized[0].i)) || it.color;
                    it.pupilColor = findColor(rootContents(it.layer).property(sized[1].i));
                    it.pupilSize = sized[1].size;
                }
            }
            if (it.w < 1 || it.h < 1) throw new Error("\"" + it.name + "\" looks empty.");
        }

        var look = layerByName(comp, "CTRL Look") ? "CTRL Look" : null, head = layerByName(comp, "CTRL Head");
        // eye sliders go on CTRL Eyes if it exists, otherwise on CTRL Look, otherwise a new CTRL Eyes
        var ctrl = layerByName(comp, "CTRL Eyes") || layerByName(comp, "CTRL Look");
        if (!ctrl) {
            var p = worldPoint(comp, items[0].layer);
            ctrl = ZER.makeController(comp, "CTRL Eyes", o.ctrlType, [p[0], p[1] - items[0].h], 50);
            if (head) ctrl.parent = head;
        }
        var fx = ctrl.property("ADBE Effect Parade");
        // the sliders: one shared set, or (perEye) one set per eye with " L" / " R" (or " 1", " 2"...) on the end
        function simpleControls(it, sfx) {
            var size = Math.min(it.w, it.h);
            if (o.pupil) addPupilPoint(ctrl, sfx);
            var list = [["Eye Open", 100], ["Pupil Size", it.pupilSize || size * 0.5], ["Pupil Follow", 0.3], ["Convergence", 0]];
            for (var c = 0; c < list.length; c++) {
                if (!o.pupil && c > 0) break;
                var name = list[c][0] === "Convergence" ? "Convergence" : list[c][0] + sfx;
                if (fx.property(name)) continue;
                var sl = fx.addProperty("ADBE Slider Control"); sl.name = name; sl.property(1).setValue(list[c][1]);
            }
        }
        if (!o.perEye) simpleControls(items[0], "");

        // left / right side of each eye (for Convergence): compare world x to the middle of all eyes
        var midX = 0;
        for (i = 0; i < items.length; i++) {
            items[i].wx = evalInComp(comp, "thisComp.layer(" + items[i].layer.index + ").toWorld([" + items[i].center[0] + ", " + items[i].center[1] + "])")[0];
            midX += items[i].wx / items.length;
        }

        var made = [];
        for (i = 0; i < items.length; i++) {
            var x = items[i], rc = rootContents(x.layer);
            // switch the original drawing off
            if (x.index) rc.property(x.index).enabled = false;
            else for (var k = 1; k <= rc.numProperties; k++) rc.property(k).enabled = false;
            var nm = uniqueGroupName(x.layer, "Rig " + x.name);
            var side = items.length < 2 ? 0 : (x.wx < midX ? 1 : -1);
            var sfx = "";
            if (o.perEye && items.length > 1) {
                sfx = items.length === 2 ? (side === 1 ? " L" : " R") : " " + (i + 1);
                simpleControls(x, sfx);
            } else if (o.perEye) simpleControls(x, "");
            buildSimpleEye(comp, x.layer, nm, x.center, x.w, x.h, x.color, ctrl.name, look, o.pupil, x.pupilColor, side, sfx);
            made.push(nm);
        }
        return { ctrl: ctrl, groups: made };
    };

    // ------------------------------------------------------------------
    // UI
    // ------------------------------------------------------------------

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Zen Easy Rig", undefined, { resizeable: true });
        // Scrolling: everything lives in "content", inside a "view" that clips it.
        // When the panel is shorter than the content, the scrollbar on the right moves it.
        win.orientation = "row";
        win.alignChildren = ["fill", "fill"];
        win.spacing = 2;
        win.margins = 4;
        var view = win.add("group");
        view.orientation = "column";
        view.alignChildren = ["fill", "top"];
        view.alignment = ["fill", "fill"];
        view.margins = 4;
        view.preferredSize = [300, 120];   // don't let the content's height force the panel taller
        view.minimumSize = [120, 60];
        var content = view.add("group");
        content.orientation = "column";
        content.alignChildren = ["fill", "top"];
        content.alignment = ["fill", "top"];
        content.spacing = 6;
        var scroll = win.add("scrollbar", undefined, 0, 0, 100);
        scroll.alignment = ["right", "fill"];
        scroll.preferredSize.width = 16;

        var gCtrl = content.add("group");
        gCtrl.add("statictext", undefined, "Controller:");
        var ddCtrl = gCtrl.add("dropdownlist", undefined, ["Null", "Shape (guide)"]);
        ddCtrl.selection = 0;
        ddCtrl.helpTip = "Null: a plain null.\nShape (guide): a square with a crosshair, Guide Layer on, so it never renders.";

        var tabs = content.add("tabbedpanel");
        tabs.alignChildren = ["fill", "top"];
        var pIK = tabs.add("tab", undefined, "IK");
        var pFace = tabs.add("tab", undefined, "Face");
        var pExtra = tabs.add("tab", undefined, "Extras");
        tabs.selection = pIK;
        pIK.add("statictext", undefined, "Select 3 layers (upper, lower, end),\n3 shape groups (or a shape layer with 3),\n3 points (pins, effect points...)\nor 1 path with 3+ points", { multiline: true });
        pIK.alignChildren = ["left", "top"];
        var cbIKFK = pIK.add("checkbox", undefined, "IK / FK slider"); cbIKFK.value = true;
        var cbStretch = pIK.add("checkbox", undefined, "Stretch"); cbStretch.value = false;
        var cbFollow = pIK.add("checkbox", undefined, "End follows controller rotation"); cbFollow.value = true;
        var gSoft = pIK.add("group");
        gSoft.add("statictext", undefined, "Soft IK %:");
        var etSoft = gSoft.add("edittext", undefined, "5"); etSoft.characters = 4;
        etSoft.helpTip = "0 = classic IK (pops when the arm gets straight). 5-10 = smooth.";
        var btIK = pIK.add("button", undefined, "Create IK");
        btIK.alignment = ["fill", "top"];

        var pPar = pIK.add("panel", undefined, "Parenting (parent = last selected)");
        pPar.alignChildren = ["fill", "top"];
        pPar.alignment = ["fill", "top"];
        var btPar = pPar.add("button", undefined, "Simple Parent");
        btPar.helpTip = "Parents every selected layer to the last one you selected.";
        var btParU = pPar.add("button", undefined, "Simple Parent (unparented only)");
        btParU.helpTip = "Same, but layers that already have a parent keep it.";
        function parentBtn(only) {
            return function () {
                var comp = app.project.activeItem;
                app.beginUndoGroup(only ? "Parent Unparented Layers" : "Parent Selected Layers");
                try {
                    if (!(comp instanceof CompItem)) throw new Error("Open a composition first.");
                    ZER.parentToLast(comp, comp.selectedLayers, only);
                } catch (e) { alert(e.message, "Zen Easy Rig"); }
                app.endUndoGroup();
            };
        }
        btPar.onClick = parentBtn(false);
        btParU.onClick = parentBtn(true);

        btIK.onClick = function () {
            var comp = app.project.activeItem;
            app.beginUndoGroup("Zen Easy Rig: Create IK");
            try {
                var opt = {
                    ctrlType: ddCtrl.selection.index === 1 ? "Shape" : "Null",
                    ikfk: cbIKFK.value,
                    stretch: cbStretch.value,
                    endFollow: cbFollow.value,
                    soft: parseFloat(etSoft.text) || 0
                };
                if (!(comp instanceof CompItem)) throw new Error("Open a composition first.");
                ZER.createIKFromSelection(comp, comp.selectedLayers, comp.selectedProperties, opt);
            } catch (e) {
                alert(e.message, "Zen Easy Rig");
            }
            app.endUndoGroup();
        };

        // ---------------- Face tab ----------------
        function ctrlType() { return ddCtrl.selection.index === 1 ? "Shape" : "Null"; }
        function run(name, fn) {
            var comp = app.project.activeItem;
            app.beginUndoGroup("Zen Easy Rig: " + name);
            try {
                if (!(comp instanceof CompItem)) throw new Error("Open a composition first.");
                fn(comp);
            } catch (e) { alert(e.message, "Zen Easy Rig"); }
            app.endUndoGroup();
        }
        function numOf(et, d) { var v = parseFloat(et.text); return isNaN(v) ? d : v; }
        function row(parent) { var g = parent.add("group"); g.alignChildren = ["left", "center"]; return g; }

        // A titled panel for one group of tools.
        function section(parent, title) {
            var p = parent.add("panel", undefined, title);
            p.alignChildren = ["left", "top"];
            return p;
        }

        pFace.alignChildren = ["fill", "top"];
        var pHead = section(pFace, "Head + Look controls", true);
        var btHead = pHead.add("button", undefined, "Create Head + Look controls");
        btHead.helpTip = "Select the base head shape first (optional): CTRL Head is made at its anchor point and the layer is parented to it.";
        var gLook = row(pHead);
        gLook.add("statictext", undefined, "Look control:");
        var etLook = gLook.add("edittext", undefined, "CTRL Look"); etLook.characters = 12;

        var pApply = section(pFace, "Face parts (selected layers or shape groups)", true);
        pApply.alignChildren = ["left", "top"];
        var g1 = row(pApply);
        var cbMove = g1.add("checkbox", undefined, "Move   depth"); cbMove.value = true;
        var etDepth = g1.add("edittext", undefined, "0.8"); etDepth.characters = 4;
        etDepth.helpTip = "1 = moves with the look. 0.5 = half (further back). Negative = behind the head.";
        var slDepth = pApply.add("slider", undefined, 0.8, -1, 2);
        slDepth.alignment = ["fill", "top"];
        slDepth.helpTip = etDepth.helpTip + " (Type any value in the box, the slider goes from -1 to 2.)";
        slDepth.onChanging = function () { etDepth.text = String(Math.round(slDepth.value * 100) / 100); };
        etDepth.onChange = function () {
            var v = parseFloat(etDepth.text);
            if (!isNaN(v)) slDepth.value = Math.max(-1, Math.min(2, v));
        };
        var gY = row(pApply);
        var cbSep = gY.add("checkbox", undefined, "Separate up / down depth");
        var etDepthY = gY.add("edittext", undefined, "0.5"); etDepthY.characters = 4;
        cbSep.helpTip = "Off: the depth above is used for both directions. On: it's left / right, this one is up / down.";
        var g2 = row(pApply);
        var cbSquash = g2.add("checkbox", undefined, "Squash  H");
        var etH = g2.add("edittext", undefined, "0.2"); etH.characters = 4;
        g2.add("statictext", undefined, "V");
        var etV = g2.add("edittext", undefined, "0"); etV.characters = 4;
        cbSquash.helpTip = "Scale shrinks by these amounts per pixel of look offset (horizontal / vertical).";
        var gAbs = row(pApply);
        gAbs.margins = [22, 0, 0, 0];   // indented: belongs to Squash
        var lbAbs = gAbs.add("statictext", undefined, "Both ways:");
        lbAbs.preferredSize.width = 70;   // fixed width so the label isn't clipped
        var cbAbsH = gAbs.add("checkbox", undefined, "H"); cbAbsH.value = true;
        var cbAbsV = gAbs.add("checkbox", undefined, "V"); cbAbsV.value = false;
        gAbs.helpTip = "Ticked: the part shrinks whichever way the look goes (Math.abs). Unticked: it shrinks one way and grows the other.";
        var gR = row(pApply);
        var cbRot = gR.add("checkbox", undefined, "Rotate  X");
        var etRX = gR.add("edittext", undefined, "0.1"); etRX.characters = 4;
        gR.add("statictext", undefined, "Y");
        var etRY = gR.add("edittext", undefined, "0.3"); etRY.characters = 4;
        cbRot.helpTip = "Degrees per pixel the look moves left / right (X) and up / down (Y).";
        var gFl = row(pApply);
        var cbFlip = gFl.add("checkbox", undefined, "Flip when look");
        var ddFlAxis = gFl.add("dropdownlist", undefined, ["X", "Y"]); ddFlAxis.selection = 0;
        var ddFlCmp = gFl.add("dropdownlist", undefined, [">", "<"]); ddFlCmp.selection = 1;
        var etFlThr = gFl.add("edittext", undefined, "0"); etFlThr.characters = 4;
        cbFlip.helpTip = "Mirrors the part (X: left / right, Y: upside down) while the look is past the value. X < 0 = flip at the centerline (nose).";
        var g3 = row(pApply);
        var cbShow = g3.add("checkbox", undefined, "Show when look");
        var ddAxis = g3.add("dropdownlist", undefined, ["X", "Y"]); ddAxis.selection = 0;
        var ddCmp = g3.add("dropdownlist", undefined, [">", "<"]); ddCmp.selection = 0;
        var etThr = g3.add("edittext", undefined, "0"); etThr.characters = 4;
        var gAp = row(pApply);
        var btGet = gAp.add("button", undefined, "Get from selected");
        btGet.helpTip = "Reads the settings of the selected face part (layer or shape group) into this panel, so you can tweak and re-apply.";
        var btApply = gAp.add("button", undefined, "Apply");
        var btPair = pApply.add("button", undefined, "Front / Back pair (select front, then back)");
        btPair.helpTip = "Uses the Show-when axis and value: the front shows past the value, the back before it.";

        var pEyes = section(pFace, "Eye generator", false);
        pEyes.alignChildren = ["left", "top"];
        var g4 = row(pEyes);
        g4.add("statictext", undefined, "Width");
        var etW = g4.add("edittext", undefined, "120"); etW.characters = 4;
        g4.add("statictext", undefined, "Gap");
        var etGap = g4.add("edittext", undefined, "60"); etGap.characters = 4;
        g4.add("statictext", undefined, "Lashes");
        var etLashes = g4.add("edittext", undefined, "3"); etLashes.characters = 3;
        var cbBoth = pEyes.add("checkbox", undefined, "Both eyes"); cbBoth.value = true;
        var cbInto = pEyes.add("checkbox", undefined, "Add into the selected shape layer");
        var cbEyesSep = pEyes.add("checkbox", undefined, "Separate controls per eye");
        cbEyesSep.helpTip = "Off: one set of sliders moves both eyes. On: each eye gets its own (Top Lid L, Top Lid R...). Convergence stays shared.";
        var btEyes = pEyes.add("button", undefined, "Create Eyes");

        var pSimple = section(pFace, "Simple eyes (from your drawing)", false);
        pSimple.alignChildren = ["left", "top"];
        pSimple.add("statictext", undefined, "Select eye layers or eye groups:", { multiline: true });
        var cbPupil = pSimple.add("checkbox", undefined, "With pupil"); cbPupil.value = false;
        var cbSimpleSep = pSimple.add("checkbox", undefined, "Separate controls per eye");
        cbSimpleSep.helpTip = "Off: one Eye Open (and pupil sliders) for all eyes. On: each eye gets its own (Eye Open L, Eye Open R...).";
        var btSimple = pSimple.add("button", undefined, "Make Simple Eyes");
        btSimple.helpTip = "Same size and colour as your drawing, as a rounded rectangle that blinks (CTRL Eyes > Eye Open). Your drawing is switched off, not deleted.";

        btHead.onClick = function () {
            run("Face controls", function (comp) {
                var r = ZER.createFaceControls(comp, comp.selectedLayers, ctrlType());
                etLook.text = r.look.name;
            });
        };
        btApply.onClick = function () {
            run("Apply face", function (comp) {
                ZER.applyFace(comp, ZER.faceTargets(comp), {
                    look: etLook.text, move: cbMove.value, depth: numOf(etDepth, 0.8),
                    separate: cbSep.value, depthY: numOf(etDepthY, 0.5),
                    rotate: cbRot.value, rx: numOf(etRX, 0.1), ry: numOf(etRY, 0.3),
                    squash: cbSquash.value, h: numOf(etH, 0.2), v: numOf(etV, 0), absH: cbAbsH.value, absV: cbAbsV.value,
                    flip: cbFlip.value, flipAxis: ddFlAxis.selection.text, flipGreater: ddFlCmp.selection.index === 0, flipThreshold: numOf(etFlThr, 0),
                    show: cbShow.value, axis: ddAxis.selection.text, greater: ddCmp.selection.index === 0, threshold: numOf(etThr, 0)
                });
            });
        };
        btGet.onClick = function () {
            var comp = app.project.activeItem;
            try {
                if (!(comp instanceof CompItem)) throw new Error("Open a composition first.");
                var t = ZER.faceTargets(comp);
                if (!t.length) throw new Error("Select a face part (a layer or a shape group).");
                var o = ZER.readFace(t[0]);
                function put(et, v) { if (v !== null && v !== undefined) et.text = String(v); }
                if (o.look) etLook.text = o.look;
                cbMove.value = o.move; put(etDepth, o.depth);
                if (o.depth !== undefined && o.depth !== null) slDepth.value = Math.max(-1, Math.min(2, o.depth));
                cbSep.value = !!o.separate; put(etDepthY, o.depthY);
                cbRot.value = o.rotate; put(etRX, o.rx); put(etRY, o.ry);
                cbSquash.value = o.squash; put(etH, o.h); put(etV, o.v);
                if (o.squash) { cbAbsH.value = o.absH; cbAbsV.value = o.absV; }
                cbFlip.value = o.flip;
                if (o.flip) { ddFlAxis.selection = o.flipAxis === "Y" ? 1 : 0; ddFlCmp.selection = o.flipGreater ? 0 : 1; put(etFlThr, o.flipThreshold); }
                cbShow.value = o.show;
                if (o.show) { ddAxis.selection = o.axis === "Y" ? 1 : 0; ddCmp.selection = o.greater ? 0 : 1; put(etThr, o.threshold); }
            } catch (e) { alert(e.message, "Zen Easy Rig"); }
        };
        btPair.onClick = function () {
            run("Front / Back pair", function (comp) {
                ZER.applyPair(comp, ZER.faceTargets(comp), { look: etLook.text, axis: ddAxis.selection.text, threshold: numOf(etThr, 0) });
            });
        };
        btEyes.onClick = function () {
            run("Create eyes", function (comp) {
                // drawn lines selected (2 or more points)? build the eyes around them
                var sel = comp.selectedProperties, paths = [], i;
                for (i = 0; i < sel.length; i++) { var pp = ZER.pathProp(sel[i]); if (pp && pp.matchName === "ADBE Vector Shape") paths.push(pp); }
                if (paths.length) {
                    if (cbBoth.value && paths.length === 1 && !confirm("\"Both eyes\" is ticked but only one line is selected.\n\nMake just one eye from it?", false, "Zen Easy Rig")) return;
                    var lines = [];
                    for (i = 0; i < paths.length; i++) lines.push(ZER.eyeLineFromPath(paths[i]));
                    ZER.createEyes(comp, { width: lines[0].width, lashes: Math.max(0, Math.round(numOf(etLashes, 3))), lines: lines, ctrlType: ctrlType(), perEye: cbEyesSep.value });
                    return;
                }
                var into = null;
                if (cbInto.value) {
                    var s = comp.selectedLayers;
                    if (s.length !== 1 || s[0].matchName !== "ADBE Vector Layer") throw new Error("Select one shape layer to add the eyes into.");
                    into = s[0];
                }
                ZER.createEyes(comp, { width: numOf(etW, 120), gap: numOf(etGap, 60), lashes: Math.max(0, Math.round(numOf(etLashes, 3))),
                    both: cbBoth.value, intoLayer: into, ctrlType: ctrlType(), perEye: cbEyesSep.value });
            });
        };

        btSimple.onClick = function () {
            run("Simple eyes", function (comp) {
                ZER.createSimpleEyes(comp, ZER.faceTargets(comp), { pupil: cbPupil.value, ctrlType: ctrlType(), perEye: cbSimpleSep.value });
            });
        };

        // ---------------- Extras tab ----------------
        pExtra.alignChildren = ["fill", "top"];
        var pDelay = section(pExtra, "Delay (follow the parent late)", true);
        pDelay.alignChildren = ["left", "top"];
        var gD = row(pDelay);
        gD.add("statictext", undefined, "Frames");
        var etFrames = gD.add("edittext", undefined, "1"); etFrames.characters = 4;
        var btDelay = pDelay.add("button", undefined, "Delay selected layers");
        btDelay.helpTip = "Position expression: the layer goes where its parent took it N frames ago.";

        var pIgn = section(pExtra, "Ignore parent rotation", true);
        var btIgn = pIgn.add("button", undefined, "Ignore parent rotation");
        btIgn.helpTip = "Rotation expression: the layer keeps its angle while its parent turns (it still moves with the parent).";
        btIgn.onClick = function () {
            run("Ignore parent rotation", function (comp) { ZER.applyIgnoreRotation(comp, comp.selectedLayers); });
        };

        var pMorph = section(pExtra, "Morph (poses from keyframes)", true);
        pMorph.add("statictext", undefined, "Select a property with one keyframe per pose:", { multiline: true });
        pMorph.alignChildren = ["fill", "top"];
        // a main button (one shared slider) with a small button on its right (one slider per property)
        function morphRow(label, tip, tipEach) {
            var g = pMorph.add("group");
            g.alignChildren = ["fill", "center"];
            g.spacing = 4;
            var main = g.add("button", undefined, label);
            main.alignment = ["fill", "center"];
            main.helpTip = tip;
            var each = g.add("button", undefined, "Each");
            each.preferredSize.width = 44;
            each.alignment = ["right", "center"];
            each.helpTip = tipEach;
            return { main: main, each: each };
        }
        var mPose = morphRow("Create Morph control",
            "One Morph slider for everything selected: 0 = each property's first keyframe pose, 1 = its second... Goes on the Look control for face parts, on the layer if everything is on one layer, otherwise on a new CTRL Morph.",
            "Same, but every selected property gets its own Morph slider.");
        var mTime = morphRow("Create Morph (Time based)",
            "One Morph Time slider plays everything selected together: 0 = first keyframe, 100 = last. Same placement as Create Morph control.",
            "Same, but every selected property gets its own Morph Time slider, covering only its own keyframes.");
        function poseMorph(each) { return function () { run("Morph control", function (comp) { ZER.createMorph(comp, comp.selectedProperties, etLook.text, each, ctrlType()); }); }; }
        function timeMorph(each) { return function () { run("Morph (time)", function (comp) { ZER.createTimeMorph(comp, comp.selectedProperties, etLook.text, ctrlType(), each); }); }; }
        mPose.main.onClick = poseMorph(false);  mPose.each.onClick = poseMorph(true);
        mTime.main.onClick = timeMorph(false);  mTime.each.onClick = timeMorph(true);
        var btMorphX = pMorph.add("button", undefined, "Remove Morph");
        btMorphX.helpTip = "Takes the morph off the selected properties (or the selected layers), so you can fix the keyframes and re-create it. Unused Morph sliders are deleted.";
        btMorphX.onClick = function () {
            run("Remove morph", function (comp) { ZER.removeMorph(comp, comp.selectedProperties, comp.selectedLayers); });
        };

        var pCopy = section(pExtra, "Copy / paste controls", true);
        pCopy.alignChildren = ["fill", "top"];
        var gCP = row(pCopy);
        var btCopyC = gCP.add("button", undefined, "Copy controls");
        var btPasteC = gCP.add("button", undefined, "Paste + link");
        var stCopy = pCopy.add("statictext", undefined, "Nothing copied yet.");
        stCopy.characters = 30;
        btCopyC.helpTip = "Remembers the expression controls of the selected layers (or only the selected controls).";
        btPasteC.helpTip = "Creates the same controls on the selected layer and links the old ones to them, so everything that used the old controls is now driven from here.";
        btCopyC.onClick = function () {
            var comp = app.project.activeItem;
            try {
                if (!(comp instanceof CompItem)) throw new Error("Open a composition first.");
                var c = ZER.copyControls(comp, comp.selectedLayers, comp.selectedProperties);
                stCopy.text = c.count + " control" + (c.count > 1 ? "s" : "") + " from " + (c.sources.length > 1 ? c.sources.length + " layers" : c.sources[0].layerName);
            } catch (e) { alert(e.message, "Zen Easy Rig"); }
        };
        btPasteC.onClick = function () {
            run("Paste controls", function (comp) {
                if (comp.selectedLayers.length > 1) throw new Error("Select just one layer to paste on.");
                var m = ZER.pasteControls(comp, comp.selectedLayers[0]);
                stCopy.text = "Pasted " + m.length + " and linked the old ones.";
            });
        };

        var pFan = section(pExtra, "Fan rig (fingers, feathers...)", true);
        pFan.alignChildren = ["left", "top"];
        pFan.add("statictext", undefined, "Select layers, or groups in one shape layer,\nin order (first to last).", { multiline: true });
        var gF = row(pFan);
        gF.add("statictext", undefined, "Spread from");
        var ddFan = gF.add("dropdownlist", undefined, ["Center", "First layer"]); ddFan.selection = 0;
        var btFan = pFan.add("button", undefined, "Create Fan rig");
        btFan.helpTip = "Adds CTRL Fan with two angles: Fan spreads the layers apart, Rotate turns them all together.";

        btDelay.onClick = function () {
            run("Delay", function (comp) { ZER.applyDelay(comp, comp.selectedLayers, numOf(etFrames, 1)); });
        };
        btFan.onClick = function () {
            run("Fan rig", function (comp) {
                var o = { ctrlType: ctrlType(), fromCenter: ddFan.selection.index === 0 };
                var groups = [], sel = comp.selectedProperties;
                for (var i = 0; i < sel.length; i++) if (sel[i].matchName === "ADBE Vector Group") groups.push(sel[i]);
                if (groups.length) ZER.createGroupFan(comp, groups, o);
                else ZER.createFan(comp, comp.selectedLayers, o);
            });
        };

        var firstLayout = true;
        function relayout() {
            // measure the content at its natural height, then fit it back into the panel's real size
            var keep = (win instanceof Window && win.size && !firstLayout) ? [win.size[0], win.size[1]] : null;
            win.layout.layout(true);
            var full = content.preferredSize.height;
            if (win instanceof Window) {
                win.size = keep || [win.size[0], Math.min(full + 40, 720)];   // floating window: keep its size (first time: up to 720 px)
                win.layout.resize();
            }
            firstLayout = false;
            // size the visible area from the panel itself (the docked panel's size is set by After Effects)
            var W = win.size[0], H = win.size[1];
            view.size = [Math.max(60, W - 26), Math.max(40, H - 8)];
            scroll.size = [16, Math.max(40, H - 8)];
            scroll.location = [W - 20, 4];
            var room = view.size[1] - 8;
            content.size = [view.size[0] - 8, Math.max(full, room)];
            var extra = Math.max(0, full - room);
            scroll.maxvalue = extra;
            scroll.enabled = extra > 0;
            if (scroll.value > extra) scroll.value = extra;
            scroll.stepdelta = 30;
            scroll.jumpdelta = Math.max(30, room * 0.8);
            content.location.y = 4 - scroll.value;
        }
        scroll.onChanging = scroll.onChange = function () { content.location.y = 4 - scroll.value; };
        tabs.onChange = function () { scroll.value = 0; relayout(); };
        win.onResizing = win.onResize = function () { this.layout.resize(); relayout(); };
        win.zerRelayout = relayout;   // used by the tests
        if ($.global.ZER_UI_TEST) { win.layout.layout(true); relayout(); $.global.ZER_WIN = win; }   // tests build the panel without showing it
        else if (win instanceof Window) { win.center(); win.show(); relayout(); } else { win.layout.layout(true); relayout(); }
        return win;
    }

    // Tests load this file with $.global.ZER_NO_UI = true to reach the functions.
    if ($.global.ZER_NO_UI) $.global.ZER = ZER;
    else buildUI(thisObj);

})(this);
