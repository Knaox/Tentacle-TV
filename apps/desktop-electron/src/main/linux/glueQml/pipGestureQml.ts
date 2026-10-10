/**
 * Les gestes du PiP — glisser la fenêtre, tirer un coin —, exécutés par la
 * colle : un fragment du QML (`kwinGlueTemplate.ts` l'assemble).
 *
 * # Pourquoi la colle, et pas `app-region: drag`
 *
 * Au-dessus d'une zone `app-region: drag`, Electron ne transmet plus rien à la
 * page : ni survol, ni molette, ni double-clic — et un `mouseleave` dès que le
 * curseur y entre, comme s'il quittait la fenêtre. Les contrôles du PiP ne
 * paraissaient qu'au survol d'un bouton (banc du 09.10.2026, souris factice).
 * Et une fenêtre transparente sans cadre n'a aucun bord de redimensionnement.
 *
 * La page garde donc toute la souris, et ANNONCE le geste dans le titre de la
 * fenêtre (`pip/pipCaptions.ts` : « <titre> [move] », « <titre> [top-left] »…)
 * dès que le bouton enfoncé a bougé. La colle, qui connaît le curseur et place
 * les fenêtres, le suit (`Workspace.cursorPosChanged`) jusqu'à ce que le titre
 * redevienne celui du mode. Glisser porte le point saisi (« [move 162 102] ») :
 * la colle le garde sous le curseur, sans le retard du seuil ni de l'annonce.
 * Le bouton reste tenu par la page (prise implicite de Wayland) : KWin met le
 * curseur à jour quand même.
 *
 * ⚠️ Une chaîne à accents graves : JAMAIS d'accent grave ni de dollar suivi
 * d'une accolade dans le QML, commentaires compris. Et aucune fonction nommée
 * comme le signal d'une propriété (`pipGestureChanged`, `gestureStartChanged`).
 */

export const PIP_GESTURE_QML = `
    // Le geste annoncé dans le titre — « move X Y », un coin, ou rien.
    function gestureOf(w) {
        var c = w.captionNormal;
        var open = __PIP_GESTURE_OPEN__;
        var close = __PIP_GESTURE_CLOSE__;
        var k = c.indexOf(open);
        if (k < 0 || c.length < k + open.length + close.length) return "";
        if (c.substring(c.length - close.length) !== close) return "";
        return c.substring(k + open.length, c.length - close.length);
    }
    function endGesture() {
        if (root.pipGesture !== "") {
            try { Kwin.Workspace.cursorPosChanged.disconnect(root.followCursor); } catch (e) { }
        }
        root.pipGesture = "";
        root.gestureStart = null;
    }
    // Le titre du PiP a changé de geste : on commence à suivre le curseur, ou on cesse.
    // Un mouvement animé (« enter », « restore », « size ») n'est pas un
    // geste : la colle le joue une fois (pipMotionQml.ts).
    function followGesture() {
        var gesture = root.pip === null ? "" : root.gestureOf(root.pip);
        if (root.isCommand(gesture)) {
            root.endGesture();
            root.runCommand(gesture);
            return;
        }
        root.pipCommand = "";
        if (gesture === root.pipGesture) return;
        root.endGesture();
        if (gesture !== "") root.stopPipMotion();
        // Ancré, le PiP est le coin de l'application : il ne se glisse pas.
        if (gesture === "" || (gesture.indexOf("move") === 0 && !root.floating())) return;
        var g = root.pip.frameGeometry;
        var c = Kwin.Workspace.cursorPos;
        // Le point saisi : la fenêtre se place pour le garder sous le curseur.
        var parts = gesture.split(" ");
        var gx = parts.length === 3 ? Number(parts[1]) : NaN;
        var gy = parts.length === 3 ? Number(parts[2]) : NaN;
        if (isFinite(gx) && isFinite(gy)) c = Qt.point(g.x + gx, g.y + gy);
        root.pipGesture = gesture;
        root.gestureStart = { x: g.x, y: g.y, width: g.width, height: g.height, cx: c.x, cy: c.y };
        Kwin.Workspace.cursorPosChanged.connect(root.followCursor);
    }
    function followCursor() {
        var s = root.gestureStart;
        if (root.pip === null || s === null) return;
        var c = Kwin.Workspace.cursorPos;
        if (root.pipGesture.indexOf("move") === 0) root.dragPip(s, c);
        else root.stretchPip(s, c.x - s.cx, c.y - s.cy);
    }
    // Glisser : le PiP suit le curseur, son cadre VISIBLE gardé dans la zone
    // utile de l'écran sous le curseur — l'ombre, elle, peut déborder.
    function dragPip(s, cursor) {
        var output = null;
        try { output = Kwin.Workspace.screenAt(cursor); } catch (e) { output = null; }
        var a = root.workArea(output === null ? root.pip.output : output);
        var sh = __PIP_SHADOW__;
        var x = Math.max(a.x - sh, Math.min(s.x + cursor.x - s.cx, a.x + a.width - s.width + sh));
        var y = Math.max(a.y - sh, Math.min(s.y + cursor.y - s.cy, a.y + a.height - s.height + sh));
        root.pipRect = Qt.rect(x, y, s.width, s.height);
        root.pip.frameGeometry = root.pipRect;
    }
    // Tirer un coin : le coin opposé reste fixe, le ratio de l'image est gardé.
    // La taille suit la projection du déplacement sur la diagonale du PiP : un
    // geste seulement horizontal (ou vertical) agit aussi, à mi-course.
    function stretchPip(s, dx, dy) {
        var i = __PIP_INSET__;
        var left = root.pipGesture.indexOf("left") >= 0;
        var top = root.pipGesture.indexOf("top") === 0;
        var w0 = s.width - 2 * i;
        var h0 = s.height - 2 * i;
        var w1 = w0 + (left ? -dx : dx);
        var h1 = h0 + (top ? -dy : dy);
        var aspect = w0 / h0;
        var share = root.floating() || root.host === null
            ? root.pip.output.geometry.width * __PIP_SHARE_FLOATING__
            : root.host.clientGeometry.width * __PIP_SHARE_DOCKED__;
        var w = w0 * (w1 * w0 + h1 * h0) / (w0 * w0 + h0 * h0);
        w = Math.min(w, Math.max(share, __PIP_MIN_WIDTH__));
        w = Math.max(w, __PIP_MIN_WIDTH__, __PIP_MIN_HEIGHT__ * aspect);
        var h = Math.round(w / aspect) + 2 * i;
        w = Math.round(w) + 2 * i;
        root.pipRect = Qt.rect(left ? s.x + s.width - w : s.x, top ? s.y + s.height - h : s.y, w, h);
        root.pip.frameGeometry = root.pipRect;
    }
`;
