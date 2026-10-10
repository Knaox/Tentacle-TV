/**
 * La fenêtre PiP — un fragment du QML de la colle (`kwinGlueTemplate.ts`
 * l'assemble). La coquille ouvre une petite fenêtre transparente sans cadre
 * (`pip/pipWindow.ts`) ; la vidéo la suit À LA PLACE de l'hôte, et l'hôte
 * redevient une fenêtre d'application ordinaire.
 *
 * # Reconnue à son titre, seule voie de la coquille vers la colle
 *
 * La colle vit dans le compositeur ; la coquille ne lui parle qu'en posant
 * des états de fenêtre qu'elle observe. Le TITRE de la fenêtre PiP porte son
 * mode — flottant (au-dessus de tout, déplaçable sur tout le bureau) ou ancré
 * (dans le coin de l'application, qu'il suit) — et le changer bascule le mode,
 * sans aller-retour D-Bus ni nouvelle pose. Ce titre ne se voit nulle part : la
 * colle retire la fenêtre de la barre des tâches et d'Alt+Tab.
 *
 * # Ce que le banc du 09.10.2026 a fixé (docs/LINUX-FENETRE-VIDEO.md)
 *
 * - flottant : coin bas-droit de la zone utile de l'écran de l'application,
 *   à 20 px — la marge du PiP natif de KDE (PictureInPictureMargin) —, sur
 *   tous les bureaux, `keepAbove` ; glissé jusque sur un autre écran, la
 *   vidéo suit au pixel ;
 * - ancré : coin bas-droit de la ZONE CLIENT de l'hôte (cadre exclu), suit
 *   ses déplacements, se réduit avec lui ;
 * - l'ordre hôte < vidéo < PiP est tenu par KWin lui-même
 *   (`Workspace.constrain`, 6.5+) : la fenêtre ACTIVE de l'application ne
 *   passe pas devant son mini-lecteur, et un PiP flottant reste visible
 *   au-dessus d'une application plein écran ;
 * - une taille changée par la coquille (molette) grandit depuis le haut-gauche
 *   côté client : on garde fixe le coin le plus proche du bord de l'écran.
 *
 * # Le cadre (pip/pipFrame.ts)
 *
 * La fenêtre PiP déborde de la vidéo d'un liseré et d'une ombre : la vidéo est
 * collée À L'INTÉRIEUR (`followQml.ts`), et les marges se comptent au cadre
 * visible — l'ombre déborde. Glisser et redimensionner sont des gestes que la
 * page annonce et que la colle exécute (`pipGestureQml.ts`).
 *
 * ⚠️ Une chaîne à accents graves : JAMAIS d'accent grave ni de dollar suivi
 * d'une accolade dans le QML, commentaires compris. Et aucune fonction nommée
 * comme le signal qu'une propriété engendre (`pip` → `pipChanged`) : le
 * composant entier refuse de se charger (« Duplicate method name », banc du
 * 09.10.2026).
 */

export const PIP_QML = `
    // Le mode, lu dans le titre sans le geste en cours (« <titre> [<geste>] »).
    function modeOf(w) {
        var c = w.captionNormal;
        var k = c.indexOf(__PIP_GESTURE_OPEN__);
        if (k >= 0) c = c.substring(0, k);
        if (c === __PIP_FLOATING__) return "floating";
        if (c === __PIP_DOCKED__) return "docked";
        return "";
    }
    function floating() { return root.pip !== null && root.pipMode === "floating"; }
    // La zone utile (panneaux exclus) de l'écran donné — 2 vaut MaximizeArea.
    function workArea(output) {
        var a = null;
        try { a = Kwin.Workspace.clientArea(2, output, Kwin.Workspace.currentDesktop); } catch (e) { a = null; }
        return a === null ? output.geometry : a;
    }
    // Le coin du PiP, son cadre VISIBLE à la marge du bord : l'ombre déborde.
    // La TAILLE est celle que la coquille a donnée à la fenêtre.
    function placePip() {
        if (root.pip === null || root.host === null) return;
        var s = root.pip.frameGeometry;
        root.pipRect = root.cornerRect(s.width, s.height);
        root.pip.frameGeometry = root.pipRect;
    }
    function cornerRect(width, height) {
        if (root.host === null) return null;
        var a = root.floating() ? root.workArea(root.host.output) : root.host.clientGeometry;
        var m = __PIP_MARGIN__ - __PIP_SHADOW__;
        return Qt.rect(a.x + a.width - width - m, a.y + a.height - height - m, width, height);
    }
    // Une nouvelle taille, flottant : le coin le plus proche du bord de l'écran
    // reste fixe, et le cadre visible ne déborde jamais de la zone utile —
    // l'ombre, si.
    function anchoredRect(before, width, height) {
        var a = root.workArea(root.pip.output);
        var sh = __PIP_SHADOW__;
        var right = before.x + before.width / 2 > a.x + a.width / 2;
        var bottom = before.y + before.height / 2 > a.y + a.height / 2;
        var x = right ? before.x + before.width - width : before.x;
        var y = bottom ? before.y + before.height - height : before.y;
        x = Math.max(a.x - sh, Math.min(x, a.x + a.width - width + sh));
        y = Math.max(a.y - sh, Math.min(y, a.y + a.height - height + sh));
        return Qt.rect(x, y, width, height);
    }
    function pipMoved() {
        if (root.pip === null) return;
        var g = root.pip.frameGeometry;
        var before = root.pipRect;
        root.pipRect = Qt.rect(g.x, g.y, g.width, g.height);
        var resized = before !== null && (before.width !== g.width || before.height !== g.height);
        // Un geste de la page, un mouvement animé (pipMotionQml.ts) placent
        // eux-mêmes la fenêtre.
        if (resized && root.pipGesture === "" && root.anim === null && !root.pip.move && !root.pip.resize) {
            if (!root.floating()) {
                root.placePip();
                return;
            }
            var r = root.anchoredRect(before, g.width, g.height);
            if (r.x !== g.x || r.y !== g.y) {
                root.pipRect = r;
                root.pip.frameGeometry = root.pipRect;
                return;
            }
        }
        root.glue();
    }
    function hostMoved() {
        if (root.pip !== null && !root.floating() && root.anim === null) root.placePip();
        root.glue();
    }
    // Flottant, la vidéo suit la réduction du PiP (un raccourci de KWin est la
    // seule voie pour réduire une fenêtre absente de la barre des tâches).
    function followPipMinimized() {
        if (!root.floating() || root.video === null) return;
        root.video.minimized = root.pip.minimized;
    }
    function adoptPip(w) {
        var mode = root.modeOf(w);
        if (mode === "" || (root.pip !== null && root.pip !== w)) return;
        var fresh = root.pip === null;
        root.pip = w;
        root.pipMode = mode;
        if (fresh) {
            w.noBorder = true;
            w.skipTaskbar = true;
            w.skipSwitcher = true;
            w.skipPager = true;
            w.frameGeometryChanged.connect(root.pipMoved);
            try { w.minimizedChanged.connect(root.followPipMinimized); } catch (e) { }
            w.closed.connect(root.pipClosed);
        }
        // Une bascule vers « flottant » laisse le PiP où il est ; tout le reste
        // le range dans son coin.
        if (fresh || mode === "docked") root.placePip();
        root.followGesture();
        // Le PiP naît actif : l'utilisateur, lui, continue dans l'application.
        if (fresh && w.active && root.host !== null && !root.host.minimized) Kwin.Workspace.activeWindow = root.host;
        console.warn("[tentacle-colle] PiP " + (fresh ? "adopté" : "basculé") + " — " + mode);
        root.sync();
    }
    // Un titre a changé : une fenêtre devient PiP, change de mode, ou cesse de
    // l'être. Branché sur toutes les fenêtres de l'application hors vidéo.
    function captionChanged() {
        var ws = Kwin.Workspace.windows;
        for (var i = 0; i < ws.length; i++) {
            var w = ws[i];
            if (w.pid !== __PID__ || root.isVideo(w) || w === root.host) continue;
            if (w === root.pip && root.modeOf(w) === "") { root.pipClosed(); continue; }
            if (w === root.pip && root.modeOf(w) === root.pipMode) { root.followGesture(); continue; }
            root.adoptPip(w);
        }
    }
    function pipClosed() {
        var p = root.pip;
        if (p === null) return;
        root.endGesture();
        root.stopPipMotion();
        root.pipCommand = "";
        root.pip = null;
        root.pipMode = "";
        root.pipRect = null;
        p.frameGeometryChanged.disconnect(root.pipMoved);
        try { p.minimizedChanged.disconnect(root.followPipMinimized); } catch (e) { }
        p.closed.disconnect(root.pipClosed);
        root.forgetConstraints(p);
        console.warn("[tentacle-colle] PiP fermé");
        root.sync();
    }
`;
