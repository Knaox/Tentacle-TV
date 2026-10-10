/**
 * Les mouvements animés du PiP sous Linux — un fragment du QML de la colle
 * (`kwinGlueTemplate.ts` l'assemble).
 *
 * Sur macOS et Windows, la coquille anime elle-même le cadre du PiP
 * (`pip/pipShell.ts`) : l'image glisse du lecteur à son coin, y revient au
 * retour, et une nouvelle taille (molette) y glisse au lieu de sauter. Sous
 * Wayland, seul le compositeur place une fenêtre : c'est donc la colle qui
 * anime, sur les MÊMES règles (`pip/pipMotion.ts` : image du lecteur, courbe
 * décélérée, pas bornés après un trou), commandée par le titre comme les
 * gestes (`pip/pipCaptions.ts` : « [enter 280] », « [restore 220] »,
 * « [size L H 120] »). La vidéo suit le cadre à chaque pas (`glue`).
 *
 * Le point de départ est la DERNIÈRE géométrie demandée (`pipRect`), jamais
 * `frameGeometry` relue : sous Wayland, une taille écrite n'y paraît qu'une
 * fois le client d'accord — relue aussitôt, c'est encore l'ancienne, et
 * l'entrée se croyait arrivée avant de partir (banc du 10.10.2026).
 *
 * Une fois l'animation finie, le client peut encore livrer en retard une
 * taille intermédiaire : la colle la laisse passer sans recaler le PiP
 * (`settle`), sans quoi elle redemanderait cette taille-là — et la dernière
 * serait perdue.
 *
 * ⚠️ Une chaîne à accents graves : JAMAIS d'accent grave ni de dollar suivi
 * d'une accolade dans le QML, commentaires compris. Et aucune fonction nommée
 * comme le signal d'une propriété (`animChanged`, `pipCommandChanged`).
 */

export const PIP_MOTION_QML = `
    // Un mouvement annoncé dans le titre, et non un geste à suivre au curseur.
    function isCommand(text) {
        var kind = text.split(" ")[0];
        return __PIP_COMMAND_KINDS__.indexOf(kind) >= 0;
    }
    function runCommand(text) {
        if (root.pip === null || text === root.pipCommand) return;
        root.pipCommand = text;
        var parts = text.split(" ");
        var ms = Number(parts[parts.length - 1]);
        if (!isFinite(ms) || ms < 0) ms = 0;
        if (parts[0] === "enter") {
            // Le PiP vient d'être rangé dans son coin (adoptPip) : il en part
            // de l'image du lecteur, et y revient.
            var corner = root.pipRect;
            if (corner === null || root.host === null || ms === 0) return;
            var from = root.pictureRect();
            root.pipRect = from;
            root.pip.frameGeometry = from;
            root.glue();
            root.animatePip(corner, ms);
            return;
        }
        if (parts[0] === "restore") {
            if (root.host !== null) root.animatePip(root.pictureRect(), ms);
            return;
        }
        var w = Number(parts[1]);
        var h = Number(parts[2]);
        if (parts.length !== 4 || !isFinite(w) || !isFinite(h) || w < 1 || h < 1) return;
        var target = root.floating() ? root.anchoredRect(root.currentPipRect(), w, h) : root.cornerRect(w, h);
        if (target !== null) root.animatePip(target, ms);
    }
    // Là où le PiP est, ou va : la dernière géométrie demandée.
    function currentPipRect() {
        return root.pipRect !== null ? root.pipRect : root.pip.frameGeometry;
    }
    // L'image que le lecteur montre dans l'hôte, au ratio du PiP — bandes
    // noires exclues, comme mpv la centre — puis le cadre du PiP autour.
    function pictureRect() {
        var p = root.currentPipRect();
        var i = __PIP_INSET__;
        var ratio = (p.width - 2 * i) / Math.max(1, p.height - 2 * i);
        if (!isFinite(ratio) || ratio <= 0) ratio = 16 / 9;
        var a = root.host.frameGeometry;
        var w = Math.min(a.width, a.height * ratio);
        var h = w / ratio;
        return Qt.rect(Math.round(a.x + (a.width - w) / 2) - i, Math.round(a.y + (a.height - h) / 2) - i,
            Math.round(w) + 2 * i, Math.round(h) + 2 * i);
    }
    function animatePip(to, ms) {
        root.stopPipMotion();
        if (root.pip === null) return;
        var g = root.currentPipRect();
        if (ms <= 0 || (g.x === to.x && g.y === to.y && g.width === to.width && g.height === to.height)) {
            root.pipRect = Qt.rect(to.x, to.y, to.width, to.height);
            root.pip.frameGeometry = root.pipRect;
            return;
        }
        root.anim = {
            from: { x: g.x, y: g.y, width: g.width, height: g.height },
            to: { x: to.x, y: to.y, width: to.width, height: to.height },
            ms: ms, elapsed: 0, last: Date.now(), running: true
        };
        root.motionTick.start();
        root.stepPipMotion();
    }
    function stepPipMotion() {
        var a = root.anim;
        if (a === null || !a.running || root.pip === null) { root.motionTick.stop(); return; }
        var now = Date.now();
        a.elapsed += Math.min(now - a.last, __PIP_MAX_STEP__);
        a.last = now;
        var t = Math.min(1, a.elapsed / a.ms);
        var e = 1 - Math.pow(1 - t, 3);
        var at = function (f, k) { return Math.round(f + (k - f) * e); };
        root.pipRect = Qt.rect(at(a.from.x, a.to.x), at(a.from.y, a.to.y),
            at(a.from.width, a.to.width), at(a.from.height, a.to.height));
        root.pip.frameGeometry = root.pipRect;
        if (t < 1) return;
        a.running = false;
        root.motionTick.stop();
        root.motionSettle.restart();
    }
    // Un geste, un autre mouvement, la fermeture : la main l'emporte.
    function stopPipMotion() {
        root.motionTick.stop();
        root.motionSettle.stop();
        root.anim = null;
    }
`;
