/**
 * Ce que la vidéo tient de l'hôte — ou du PiP quand il y en a un —, geste par
 * geste : un fragment du QML de la colle (`kwinGlueTemplate.ts` l'assemble).
 * Le pourquoi de chaque geste est dans l'en-tête du gabarit ; ici, la règle et
 * sa raison immédiate.
 *
 * ⚠️ Une chaîne à accents graves : JAMAIS d'accent grave ni de dollar suivi
 * d'une accolade dans le QML, commentaires compris.
 */

export const FOLLOW_QML = `
    function glue() {
        if (root.video === null) return;
        if (root.pip !== null) {
            var p = root.pip.frameGeometry;
            root.video.frameGeometry = Qt.rect(p.x, p.y, p.width, p.height);
            // Ancré, l'ordre tient par les contraintes : relever la paire la
            // ferait passer devant une fenêtre qui recouvre l'application.
            if (root.floating()) {
                Kwin.Workspace.raiseWindow(root.video);
                Kwin.Workspace.raiseWindow(root.pip);
            }
            return;
        }
        if (root.host === null) return;
        // Plein écran, la vidéo a la géométrie de l'écran, imposée par KWin.
        if (!root.video.fullScreen) {
            var g = root.host.frameGeometry;
            root.video.frameGeometry = Qt.rect(g.x, g.y, g.width, g.height);
        }
        Kwin.Workspace.raiseWindow(root.video);
        Kwin.Workspace.raiseWindow(root.host);
    }
    // L'ordre que KWin doit tenir de lui-même, par paires (dessous, dessus) :
    // jamais l'interface sous la vidéo ; avec un PiP, hôte < vidéo < PiP —
    // même quand l'hôte, actif, passerait devant son mini-lecteur, et même
    // plein écran (une contrainte franchit les couches).
    function wantedConstraints() {
        if (root.video === null || root.host === null) return [];
        if (root.pip !== null) return [[root.host, root.video], [root.video, root.pip]];
        return [[root.video, root.host]];
    }
    function hasConstraint(list, c) {
        for (var i = 0; i < list.length; i++) if (list[i][0] === c[0] && list[i][1] === c[1]) return true;
        return false;
    }
    // Workspace.constrain n'existe que depuis KWin 6.5 : avant, l'appel échoue
    // et raiseWindow tient l'ordre seul, comme avant le PiP.
    function applyConstraints() {
        var wanted = root.wantedConstraints();
        var kept = [];
        for (var i = 0; i < root.constraints.length; i++) {
            var c = root.constraints[i];
            if (root.hasConstraint(wanted, c)) kept.push(c);
            else { try { Kwin.Workspace.unconstrain(c[0], c[1]); } catch (e) { } }
        }
        for (var k = 0; k < wanted.length; k++) {
            if (root.hasConstraint(kept, wanted[k])) continue;
            try { Kwin.Workspace.constrain(wanted[k][0], wanted[k][1]); kept.push(wanted[k]); } catch (e) { }
        }
        root.constraints = kept;
    }
    // Une fenêtre fermée : KWin a déjà levé ses contraintes, on les oublie.
    function forgetConstraints(w) {
        var kept = [];
        for (var i = 0; i < root.constraints.length; i++) {
            if (root.constraints[i][0] !== w && root.constraints[i][1] !== w) kept.push(root.constraints[i]);
        }
        root.constraints = kept;
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
    //
    // Avec un PiP, la vidéo prend la couche du PiP : au-dessus de tout s'il
    // flotte, celle de l'hôte s'il est ancré dans l'application.
    function followLayer() {
        if (root.host === null || root.video === null) return;
        if (root.pip !== null) {
            root.video.fullScreen = false;
            root.pip.keepAbove = root.floating() || root.host.keepAbove;
            root.pip.keepBelow = !root.floating() && root.host.keepBelow;
            root.video.keepAbove = root.pip.keepAbove;
            root.video.keepBelow = root.pip.keepBelow;
            root.applyConstraints();
            root.glue();
            return;
        }
        root.video.fullScreen = root.host.fullScreen;
        root.video.keepAbove = root.host.keepAbove || (root.host.fullScreen && root.host.active);
        root.video.keepBelow = !root.video.keepAbove && root.host.keepBelow;
        root.applyConstraints();
        if (root.host.active) root.glue();
    }
    // KWin active volontiers mpv — à sa naissance, et quand l'hôte se réduit
    // (fenêtre suivante de la chaîne de focus). Rendre l'activation à un hôte
    // RÉDUIT le restaurerait : activateWindow dé-réduit ce qu'il active. Un PiP
    // flottant la reçoit à la place : c'est lui qu'on vient de toucher.
    function reclaimActivation() {
        if (root.host === null || root.video === null || !root.video.active) return;
        if (root.floating()) {
            Kwin.Workspace.activeWindow = root.pip;
            return;
        }
        if (root.host.minimized) {
            root.minimizeLater.restart();
            return;
        }
        Kwin.Workspace.activeWindow = root.host;
    }
    // Réduire l'application ne réduit pas un PiP flottant — c'est son rôle.
    function minimizeWithHost() {
        if (root.host === null || root.video === null || !root.host.minimized || root.floating()) return;
        root.video.minimized = true;
        if (root.pip !== null) root.pip.minimized = true;
    }
    function followMinimized() {
        if (root.host === null || root.video === null || root.floating()) return;
        root.video.minimized = root.host.minimized;
        if (root.pip !== null) root.pip.minimized = root.host.minimized;
    }
    // La vidéo rendue à l'écran pendant que l'hôte est réduit — choisie dans
    // Alt+Tab : l'hôte revient avec elle, AVANT qu'elle ne soit activée.
    function followVideoMinimized() {
        if (root.host === null || root.video === null || root.floating()) return;
        if (!root.video.minimized && root.host.minimized) root.host.minimized = false;
    }
    // Flottant, le PiP est sur tous les bureaux et toutes les activités, comme
    // le PiP natif de KDE ; ancré, il suit l'hôte.
    function followDesktops() {
        if (root.host === null || root.video === null) return;
        if (root.floating()) {
            root.pip.onAllDesktops = true;
            root.video.onAllDesktops = true;
            return;
        }
        root.video.desktops = root.host.desktops;
        if (root.pip !== null) root.pip.desktops = root.host.desktops;
    }
    function followActivities() {
        if (root.host === null || root.video === null) return;
        var activities = root.floating() ? [] : root.host.activities;
        root.video.activities = activities;
        if (root.pip !== null) root.pip.activities = activities;
    }
    // Qui représente l'application dans Alt+Tab : la vidéo tant qu'elle lit
    // (titre non vide) dans la fenêtre, l'hôte sinon — mpv garé porte un titre
    // vide, et en PiP l'hôte redevient une fenêtre d'application ordinaire.
    function followSwitcher() {
        if (root.host === null) return;
        var playing = root.video !== null && root.video.captionNormal !== "" && root.pip === null;
        if (root.video !== null) root.video.skipSwitcher = !playing;
        root.host.skipSwitcher = playing;
    }
    // Tout ce que la vidéo tient de l'hôte, d'un bloc — rejoué à l'adoption de
    // chaque fenêtre : Workspace.windows ne garantit pas leur ordre.
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
