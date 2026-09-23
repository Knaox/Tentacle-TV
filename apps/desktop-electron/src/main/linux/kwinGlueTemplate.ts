/**
 * Le QML de la colle KWin — extrait de `kwinGlue.ts`, qui en dit le pourquoi
 * (moteur déclaratif, dossier neuf, types qualifiés, gestionnaires morts).
 * Ici, ce que la colle SUIT, geste par geste.
 *
 * # La réduction — la colle l'annulait elle-même (23.09.2026)
 *
 * Symptôme rapporté : « quand je réduis la fenêtre avec mpv démarré, la
 * fenêtre mpv ne suit pas, et tout bugue ». Lu dans les sources de KWin 6.7 :
 * `Window::setMinimized` passe `m_minimized` à vrai, puis `doMinimize()` rend
 * le focus à la fenêtre suivante de la chaîne — mpv, juste dessous. La colle
 * voyait mpv actif et rendait aussitôt l'activation à l'hôte… or
 * `Workspace::activateWindow` DÉ-RÉDUIT la fenêtre qu'il active
 * (`activation.cpp`, `if (window->isMinimized()) window->setMinimized(false)`).
 * La réduction s'annulait dans son propre élan, et `minimizedChanged` partait
 * avec un hôte déjà restauré : mpv ne se réduisait jamais.
 *
 * D'où : on ne rend JAMAIS l'activation à un hôte réduit — on réduit la vidéo
 * avec lui, d'un tour de boucle plus tard (hors de la pile d'activation de
 * KWin), et c'est alors la vraie fenêtre suivante qui reçoit le focus. Dans
 * l'autre sens, une vidéo rendue à l'écran (Alt+Tab la montre pendant la
 * lecture, voir plus bas) ramène l'hôte avec elle.
 *
 * # Alt+Tab — la vignette est celle d'UNE fenêtre
 *
 * `WindowThumbnailItem` ne rend que le `windowItem()` de la fenêtre désignée
 * (`scripting/windowthumbnailitem.cpp`) : la vignette de notre fenêtre montre
 * l'interface, transparente là où la vidéo se trouve — qui vit dans une AUTRE
 * fenêtre. Pendant la lecture, c'est donc la fenêtre vidéo qui représente
 * l'application dans le sélecteur (`skipSwitcher` échangé) : sa vignette
 * montre l'image, et la choisir rend la main à l'hôte (`reprendreActivation`).
 * Hors lecture — mpv garé, titre vide (`ipc/videoLifecycle.ts`) — l'hôte
 * reprend sa place : la vignette montrerait sinon une image noire.
 *
 * Le titre et l'icône de cette entrée sont ceux de l'application : mpv porte
 * le titre de notre fenêtre, et un app-id qui désigne un `.desktop` à notre
 * icône (`videoWindowIdentity.ts`). C'est aussi par cet app-id — reçu ici
 * comme `__VIDEO_CLASS__` — que la colle reconnaît la fenêtre vidéo.
 *
 * # Bureaux virtuels, activités, couches
 *
 * Même famille de défaut que la réduction : la vidéo restait sur le bureau où
 * elle était née quand on envoyait la fenêtre ailleurs, et un hôte « toujours
 * au-dessus » (ou en dessous) laissait d'autres fenêtres s'intercaler entre
 * lui et la vidéo — visibles à travers sa transparence.
 */

const TEMPLATE = `import QtQml as Qml
import org.kde.kwin as Kwin

Qml.QtObject {
    id: racine
    property var hote: null
    property var video: null
    // Rattrapage du PREMIER coller : l'écriture de géométrie est asynchrone
    // et windowAdded précède le mappage effectif — la copie posée à l'adoption
    // peut être perdue, et sans elle mpv reste à sa taille de naissance
    // jusqu'au détour d'activation (~0,5 s d'éclair, mesuré). Une minuterie
    // UNIQUE la rejoue. JAMAIS via frameGeometryChanged de la vidéo : notre
    // propre écriture déclencherait le signal qu'elle écoute (boucle).
    property var rattrapage: Qml.Timer {
        interval: 150
        repeat: false
        onTriggered: racine.coller()
    }
    // La réduction de la vidéo avec l'hôte, un tour de boucle plus tard : hors
    // de la pile d'activation de KWin, qui est en train de réduire l'hôte.
    property var reduction: Qml.Timer {
        interval: 0
        repeat: false
        onTriggered: racine.reduireAvecHote()
    }

    function estVideo(w) {
        return w.resourceClass === "mpv" || w.resourceClass === __VIDEO_CLASS__;
    }
    function coller() {
        if (racine.hote === null || racine.video === null) return;
        var g = racine.hote.frameGeometry;
        racine.video.frameGeometry = Qt.rect(g.x, g.y, g.width, g.height);
        Kwin.Workspace.raiseWindow(racine.video);
        Kwin.Workspace.raiseWindow(racine.hote);
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
    function suivreCouche() {
        if (racine.hote === null || racine.video === null) return;
        racine.video.keepAbove = racine.hote.keepAbove || (racine.hote.fullScreen && racine.hote.active);
        racine.video.keepBelow = !racine.video.keepAbove && racine.hote.keepBelow;
        if (racine.hote.active) racine.coller();
    }
    // KWin active volontiers mpv — à sa naissance, et quand l'hôte se réduit
    // (fenêtre suivante de la chaîne de focus). Rendre l'activation à un hôte
    // RÉDUIT le restaurerait : activateWindow dé-réduit ce qu'il active.
    function reprendreActivation() {
        if (racine.hote === null || racine.video === null || !racine.video.active) return;
        if (racine.hote.minimized) {
            racine.reduction.restart();
            return;
        }
        Kwin.Workspace.activeWindow = racine.hote;
    }
    function reduireAvecHote() {
        if (racine.hote === null || racine.video === null || !racine.hote.minimized) return;
        racine.video.minimized = true;
    }
    function suivreMinimise() {
        if (racine.hote === null || racine.video === null) return;
        racine.video.minimized = racine.hote.minimized;
    }
    // La vidéo rendue à l'écran pendant que l'hôte est réduit — choisie dans
    // Alt+Tab : l'hôte revient avec elle, AVANT qu'elle ne soit activée.
    function suivreMinimiseVideo() {
        if (racine.hote === null || racine.video === null) return;
        if (!racine.video.minimized && racine.hote.minimized) racine.hote.minimized = false;
    }
    function suivreBureaux() {
        if (racine.hote === null || racine.video === null) return;
        racine.video.desktops = racine.hote.desktops;
    }
    function suivreActivites() {
        if (racine.hote === null || racine.video === null) return;
        racine.video.activities = racine.hote.activities;
    }
    // Qui représente l'application dans Alt+Tab : la vidéo tant qu'elle lit
    // (titre non vide), l'hôte sinon — mpv garé porte un titre vide.
    function suivreSelecteur() {
        if (racine.hote === null) return;
        var lecture = racine.video !== null && racine.video.captionNormal !== "";
        if (racine.video !== null) racine.video.skipSwitcher = !lecture;
        racine.hote.skipSwitcher = lecture;
    }
    // Tout ce que la vidéo tient de l'hôte, d'un bloc — rejoué à l'adoption de
    // l'une ET de l'autre : Workspace.windows ne garantit pas leur ordre.
    function synchroniser() {
        racine.reprendreActivation();
        racine.suivreMinimise();
        racine.suivreBureaux();
        racine.suivreActivites();
        racine.suivreCouche();
        racine.suivreSelecteur();
        racine.coller();
    }
    // Nommées, et non anonymes : disconnect() exige la même référence.
    function videoFermee() {
        racine.video = null;
        racine.suivreSelecteur();
    }
    function hoteFerme() { racine.hote = null; }
    function prendre(w) {
        if (w.pid !== __PID__) return;
        if (racine.estVideo(w)) {
            if (racine.video !== null) return;
            racine.video = w;
            w.noBorder = true;
            w.skipTaskbar = true;
            w.skipSwitcher = true;
            w.skipPager = true;
            w.closed.connect(racine.videoFermee);
            w.activeChanged.connect(racine.reprendreActivation);
            try { w.minimizedChanged.connect(racine.suivreMinimiseVideo); } catch (e) { }
            try { w.captionNormalChanged.connect(racine.suivreSelecteur); } catch (e) { }
            racine.synchroniser();
            racine.rattrapage.restart();
            return;
        }
        if (racine.hote !== null) return;
        if (w.caption.indexOf("Developer Tools") === 0) return;
        racine.hote = w;
        w.frameGeometryChanged.connect(racine.coller);
        w.activeChanged.connect(racine.suivreCouche);
        try { w.fullScreenChanged.connect(racine.suivreCouche); } catch (e) { }
        try { w.keepAboveChanged.connect(racine.suivreCouche); } catch (e) { }
        try { w.keepBelowChanged.connect(racine.suivreCouche); } catch (e) { }
        try { w.minimizedChanged.connect(racine.suivreMinimise); } catch (e) { }
        try { w.desktopsChanged.connect(racine.suivreBureaux); } catch (e) { }
        try { w.activitiesChanged.connect(racine.suivreActivites); } catch (e) { }
        w.closed.connect(racine.hoteFerme);
        racine.synchroniser();
    }
    // Décrochée, l'instance meurt — mais pas ses connexions : KWin les garde
    // et les rappelle avec racine à null (voir l'en-tête de kwinGlue.ts). On
    // défait TOUT ce que prendre() a noué, et l'on rend la couche et la place
    // dans Alt+Tab : décrochée en pleine lecture, la fenêtre mpv survit
    // quelques instants au démontage du lecteur et resterait sinon seule
    // au-dessus du bureau entier — et l'hôte, absent du sélecteur.
    function lacher() {
        try { racine.reduction.stop(); } catch (e) { }
        if (racine.video !== null) {
            racine.video.keepAbove = false;
            racine.video.keepBelow = false;
            racine.video.skipSwitcher = true;
            racine.video.closed.disconnect(racine.videoFermee);
            racine.video.activeChanged.disconnect(racine.reprendreActivation);
            try { racine.video.minimizedChanged.disconnect(racine.suivreMinimiseVideo); } catch (e) { }
            try { racine.video.captionNormalChanged.disconnect(racine.suivreSelecteur); } catch (e) { }
        }
        if (racine.hote !== null) {
            racine.hote.skipSwitcher = false;
            racine.hote.frameGeometryChanged.disconnect(racine.coller);
            racine.hote.activeChanged.disconnect(racine.suivreCouche);
            try { racine.hote.fullScreenChanged.disconnect(racine.suivreCouche); } catch (e) { }
            try { racine.hote.keepAboveChanged.disconnect(racine.suivreCouche); } catch (e) { }
            try { racine.hote.keepBelowChanged.disconnect(racine.suivreCouche); } catch (e) { }
            try { racine.hote.minimizedChanged.disconnect(racine.suivreMinimise); } catch (e) { }
            try { racine.hote.desktopsChanged.disconnect(racine.suivreBureaux); } catch (e) { }
            try { racine.hote.activitiesChanged.disconnect(racine.suivreActivites); } catch (e) { }
            racine.hote.closed.disconnect(racine.hoteFerme);
        }
        Kwin.Workspace.windowAdded.disconnect(racine.prendre);
    }
    Qml.Component.onDestruction: racine.lacher()
    Qml.Component.onCompleted: {
        var ws = Kwin.Workspace.windows;
        for (var i = 0; i < ws.length; i++) racine.prendre(ws[i]);
        Kwin.Workspace.windowAdded.connect(racine.prendre);
        console.warn("[tentacle-colle] posée — pid __PID__, hote="
            + (racine.hote !== null) + ", video=" + (racine.video !== null));
    }
}
`;

/**
 * Le QML de la colle pour un processus donné. `videoClass` : l'app-id que
 * porte la fenêtre mpv (`videoWindowIdentity.ts`) ; sans lui, seule la classe
 * « mpv » par défaut est reconnue. Inliné en littéral JSON — un chemin peut
 * contenir espaces et guillemets, que le QML doit lire tels quels.
 */
export function glueTemplate(pid: number, videoClass: string | null = null): string {
  return TEMPLATE.replaceAll("__PID__", String(pid)).replaceAll(
    "__VIDEO_CLASS__",
    JSON.stringify(videoClass ?? "mpv"),
  );
}
