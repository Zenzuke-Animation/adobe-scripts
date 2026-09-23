#target illustrator

(function () {
    if (app.documents.length === 0) {
        alert("No hay ningún documento abierto.");
        return;
    }

    var doc = app.activeDocument;
    var total = doc.artboards.length;

    // ===== UI =====
    var dlg = new Window('dialog', 'Renombrar mesas de trabajo');
    dlg.orientation = 'column';
    dlg.alignChildren = 'fill';

    var info = dlg.add('statictext', undefined, 'Se renombrarán ' + total + ' mesas de trabajo en secuencia.');
    info.maximumSize.width = 420;

    // Prefijo
    var gPrefix = dlg.add('group'); gPrefix.alignChildren = ['left', 'center'];
    gPrefix.add('statictext', undefined, 'Prefijo:');
    var prefixEt = gPrefix.add('edittext', undefined, 'Mesa_'); prefixEt.characters = 24;

    // Número inicial
    var gStart = dlg.add('group'); gStart.alignChildren = ['left', 'center'];
    gStart.add('statictext', undefined, 'Número inicial:');
    var startEt = gStart.add('edittext', undefined, '1'); startEt.characters = 6;

    // Ceros a la izquierda
    var gPad = dlg.add('group'); gPad.alignChildren = ['left', 'center'];
    var padCb = gPad.add('checkbox', undefined, 'Rellenar con ceros');
    padCb.value = true;
    gPad.add('statictext', undefined, 'Dígitos:');
    var digitsEt = gPad.add('edittext', undefined, String(String(total).length)); digitsEt.characters = 3;

    // Vista previa
    var preview = dlg.add('statictext', undefined, 'Ejemplo:'); preview.maximumSize.width = 420;

    // Botones
    var btns = dlg.add('group'); btns.alignment = 'right';
    var okBtn = btns.add('button', undefined, 'Renombrar', { name: 'ok' });
    btns.add('button', undefined, 'Cancelar', { name: 'cancel' });

    // Helpers
    function zfill(num, digits) {
        var s = String(num);
        while (s.length < digits) s = '0' + s;
        return s;
    }

    function sanitize(s) {
        // Evita caracteres problemáticos para nombres/exports
        return s.replace(/[\\\/:\*\?"<>\|]/g, '_');
    }

    function toInt(v, def) {
        var n = parseInt(v, 10);
        return (isNaN(n)) ? def : n;
    }

    function updatePreview() {
        var pref = sanitize(prefixEt.text || '');
        var start = Math.max(0, toInt(startEt.text, 1));
        var digits = Math.max(1, toInt(digitsEt.text, 1));
        var n1 = padCb.value ? zfill(start, digits) : String(start);
        var n2 = padCb.value ? zfill(start + 1, digits) : String(start + 1);
        preview.text = 'Ejemplo: ' + pref + n1 + ', ' + pref + n2 + ', ...';
        digitsEt.enabled = padCb.value;
    }

    prefixEt.onChanging = updatePreview;
    startEt.onChanging = updatePreview;
    digitsEt.onChanging = updatePreview;
    padCb.onClick = updatePreview;
    updatePreview();

    if (dlg.show() !== 1) return; // Cancelado

    // ===== Renombrado =====
    var pref = sanitize(prefixEt.text || '');
    var start = Math.max(0, toInt(startEt.text, 1));
    var digits = Math.max(1, toInt(digitsEt.text, 1));

    app.executeMenuCommand('doc-color-rgb'); // no hace daño; asegura doc activo

    for (var i = 0; i < total; i++) {
        var num = padCb.value ? zfill(start + i, digits) : String(start + i);
        doc.artboards[i].name = pref + num;
    }

    alert('Listo: renombradas ' + total + ' mesas de trabajo.');
})();
