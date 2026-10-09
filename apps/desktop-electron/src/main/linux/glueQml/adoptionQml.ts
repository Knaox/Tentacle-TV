/**
 * L'adoption des fenêtres et le lâcher — un fragment du QML de la colle
 * (`kwinGlueTemplate.ts` l'assemble). `take` noue, `release` dénoue : KWin
 * garde les connexions d'une instance décrochée et les rappelle avec `root`
 * à null (l'en-tête de `kwinGlue.ts` dit les 2 827 exceptions que ça a coûté).
 *
 * ⚠️ Une chaîne à accents graves : JAMAIS d'accent grave ni de dollar suivi
 * d'une accolade dans le QML, commentaires compris.
 */

export const ADOPTION_QML = `
    // La vidéo sort du plein écran quand mpv l'a ACCUSÉ — après la sortie de
    // l'hôte, dont le recollage est donc passé trop tôt (mesuré au banc : la
    // vidéo restait à la taille de l'écran). On recolle à ce moment-là.
    function videoFullScreenChanged() {
        if (root.video === null || root.video.fullScreen) return;
        root.glue();
    }
    // Nommées, et non anonymes : disconnect() exige la même référence.
    function videoClosed() {
        root.video = null;
        root.followSwitcher();
    }
    function hostClosed() { root.host = null; }
    function take(w) {
        if (w.pid !== __PID__) return;
        if (root.isVideo(w)) {
            if (root.video !== null) return;
            root.video = w;
            w.noBorder = true;
            w.skipTaskbar = true;
            w.skipSwitcher = true;
            w.skipPager = true;
            w.closed.connect(root.videoClosed);
            w.activeChanged.connect(root.reclaimActivation);
            try { w.minimizedChanged.connect(root.followVideoMinimized); } catch (e) { }
            try { w.captionNormalChanged.connect(root.followSwitcher); } catch (e) { }
            try { w.fullScreenChanged.connect(root.videoFullScreenChanged); } catch (e) { }
            root.sync();
            root.catchUp.restart();
            return;
        }
        if (root.host !== null) return;
        if (w.caption.indexOf("Developer Tools") === 0) return;
        root.host = w;
        w.frameGeometryChanged.connect(root.glue);
        w.activeChanged.connect(root.followLayer);
        try { w.fullScreenChanged.connect(root.followLayer); } catch (e) { }
        try { w.keepAboveChanged.connect(root.followLayer); } catch (e) { }
        try { w.keepBelowChanged.connect(root.followLayer); } catch (e) { }
        try { w.minimizedChanged.connect(root.followMinimized); } catch (e) { }
        try { w.desktopsChanged.connect(root.followDesktops); } catch (e) { }
        try { w.activitiesChanged.connect(root.followActivities); } catch (e) { }
        w.closed.connect(root.hostClosed);
        root.sync();
    }
    // Décrochée, l'instance meurt — mais pas ses connexions : KWin les garde
    // et les rappelle avec root à null (voir l'en-tête de kwinGlue.ts). On
    // défait TOUT ce que take() a noué, et l'on rend la couche et la place
    // dans Alt+Tab : décrochée en pleine lecture, la fenêtre mpv survit
    // quelques instants au démontage du lecteur et resterait sinon seule
    // au-dessus du bureau entier — et l'hôte, absent du sélecteur.
    function release() {
        try { root.minimizeLater.stop(); } catch (e) { }
        if (root.video !== null) {
            root.video.keepAbove = false;
            root.video.keepBelow = false;
            root.video.fullScreen = false;
            root.video.skipSwitcher = true;
            root.video.closed.disconnect(root.videoClosed);
            root.video.activeChanged.disconnect(root.reclaimActivation);
            try { root.video.minimizedChanged.disconnect(root.followVideoMinimized); } catch (e) { }
            try { root.video.captionNormalChanged.disconnect(root.followSwitcher); } catch (e) { }
            try { root.video.fullScreenChanged.disconnect(root.videoFullScreenChanged); } catch (e) { }
        }
        if (root.host !== null) {
            root.host.skipSwitcher = false;
            root.host.frameGeometryChanged.disconnect(root.glue);
            root.host.activeChanged.disconnect(root.followLayer);
            try { root.host.fullScreenChanged.disconnect(root.followLayer); } catch (e) { }
            try { root.host.keepAboveChanged.disconnect(root.followLayer); } catch (e) { }
            try { root.host.keepBelowChanged.disconnect(root.followLayer); } catch (e) { }
            try { root.host.minimizedChanged.disconnect(root.followMinimized); } catch (e) { }
            try { root.host.desktopsChanged.disconnect(root.followDesktops); } catch (e) { }
            try { root.host.activitiesChanged.disconnect(root.followActivities); } catch (e) { }
            root.host.closed.disconnect(root.hostClosed);
        }
        Kwin.Workspace.windowAdded.disconnect(root.take);
    }
    Qml.Component.onDestruction: root.release()
    Qml.Component.onCompleted: {
        var ws = Kwin.Workspace.windows;
        for (var i = 0; i < ws.length; i++) root.take(ws[i]);
        Kwin.Workspace.windowAdded.connect(root.take);
        console.warn("[tentacle-colle] posée — pid __PID__, hote="
            + (root.host !== null) + ", video=" + (root.video !== null));
    }
`;
