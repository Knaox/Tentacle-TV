/**
 * Ce que la vidéo tient de l'hôte, geste par geste — un fragment du QML de la
 * colle (`kwinGlueTemplate.ts` l'assemble). Le pourquoi de chaque geste est
 * dans l'en-tête du gabarit ; ici, la règle et sa raison immédiate.
 *
 * ⚠️ Une chaîne à accents graves : JAMAIS d'accent grave ni de dollar suivi
 * d'une accolade dans le QML, commentaires compris.
 */

export const FOLLOW_QML = `
    function glue() {
        if (root.host === null || root.video === null) return;
        // Plein écran, la vidéo a la géométrie de l'écran, imposée par KWin.
        if (!root.video.fullScreen) {
            var g = root.host.frameGeometry;
            root.video.frameGeometry = Qt.rect(g.x, g.y, g.width, g.height);
        }
        Kwin.Workspace.raiseWindow(root.video);
        Kwin.Workspace.raiseWindow(root.host);
    }
    // Le panneau du bureau (barre des tâches, dock) vit dans une couche AU-DESSUS
    // des fenêtres ordinaires. En plein écran, l'hôte ACTIF la passe — mpv, lui,
    // reste dessous, et notre fenêtre étant transparente, le panneau se voit À
    // TRAVERS elle dès qu'il se montre. 'keepAbove' monte mpv d'une couche :
    // au-dessus du panneau, sous l'hôte plein écran actif (mesuré sur KWin 6.7.5,
    // docs/LINUX-FENETRE-VIDEO.md). La condition n'est pas décorative : un hôte
    // plein écran INACTIF retombe en couche normale, et mpv laissé au-dessus
    // recouvrirait l'interface — et tout le reste du bureau. Un hôte que
    // l'utilisateur garde lui-même au-dessus (ou en dessous) emmène la vidéo
    // dans sa couche : sans quoi une autre fenêtre s'intercale entre les deux.
    //
    // Et la vidéo passe en plein écran AVEC l'hôte (09.10.2026). KWin garde un
    // plein écran en couche « active » tant que la fenêtre active est sur un
    // AUTRE écran (Window::isActiveFullScreen) : un clic sur l'écran voisin
    // laissait l'hôte en haut, la vidéo retombait sous le panneau et sous les
    // notifications — visibles à travers l'hôte. Plein écran elle aussi, la
    // vidéo reçoit la même règle de KWin, écran par écran.
    function followLayer() {
        if (root.host === null || root.video === null) return;
        root.video.fullScreen = root.host.fullScreen;
        root.video.keepAbove = root.host.keepAbove || (root.host.fullScreen && root.host.active);
        root.video.keepBelow = !root.video.keepAbove && root.host.keepBelow;
        if (root.host.active) root.glue();
    }
    // KWin active volontiers mpv — à sa naissance, et quand l'hôte se réduit
    // (fenêtre suivante de la chaîne de focus). Rendre l'activation à un hôte
    // RÉDUIT le restaurerait : activateWindow dé-réduit ce qu'il active.
    function reclaimActivation() {
        if (root.host === null || root.video === null || !root.video.active) return;
        if (root.host.minimized) {
            root.minimizeLater.restart();
            return;
        }
        Kwin.Workspace.activeWindow = root.host;
    }
    function minimizeWithHost() {
        if (root.host === null || root.video === null || !root.host.minimized) return;
        root.video.minimized = true;
    }
    function followMinimized() {
        if (root.host === null || root.video === null) return;
        root.video.minimized = root.host.minimized;
    }
    // La vidéo rendue à l'écran pendant que l'hôte est réduit — choisie dans
    // Alt+Tab : l'hôte revient avec elle, AVANT qu'elle ne soit activée.
    function followVideoMinimized() {
        if (root.host === null || root.video === null) return;
        if (!root.video.minimized && root.host.minimized) root.host.minimized = false;
    }
    function followDesktops() {
        if (root.host === null || root.video === null) return;
        root.video.desktops = root.host.desktops;
    }
    function followActivities() {
        if (root.host === null || root.video === null) return;
        root.video.activities = root.host.activities;
    }
    // Qui représente l'application dans Alt+Tab : la vidéo tant qu'elle lit
    // (titre non vide), l'hôte sinon — mpv garé porte un titre vide.
    function followSwitcher() {
        if (root.host === null) return;
        var playing = root.video !== null && root.video.captionNormal !== "";
        if (root.video !== null) root.video.skipSwitcher = !playing;
        root.host.skipSwitcher = playing;
    }
    // Tout ce que la vidéo tient de l'hôte, d'un bloc — rejoué à l'adoption de
    // l'une ET de l'autre : Workspace.windows ne garantit pas leur ordre.
    function sync() {
        root.reclaimActivation();
        root.followMinimized();
        root.followDesktops();
        root.followActivities();
        root.followLayer();
        root.followSwitcher();
        root.glue();
    }
`;
