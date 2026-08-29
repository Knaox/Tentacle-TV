import { readIntent, isHorizontal, directionSign } from "../focus/keys";
import { RELIGHT_DELAY_MS, ScrubMachine, createArrowArbiter, createHoldMotor, readState, showOsd, deferAutoHide, subscribe } from "@tentacle-tv/tv-core";
import { enableFocusedOverlay, overlayShown } from "./okOverlay";
/**
 * L'arbitre unique des touches sur le lecteur.
 *
 * Trois écouteurs se disputaient les flèches : le moteur de focus, qui se
 * retirait de toute la route ; les touches de transport globales, qui écrivent
 * `currentTime` en dur ; et `usePlayerHotkeys` du client web, qui traduit les
 * flèches en sauts de trente secondes. **On n'arbitre pas par l'ordre
 * d'installation** — `stopPropagation` n'empêche pas les autres écouteurs du
 * même nœud de tirer dans la même phase, seule la remontée est coupée. La règle
 * se lit donc dans l'état : à chaque touche un propriétaire, déduit du mode.
 *
 * Ce que cet écouteur absorbe, il l'absorbe pour de bon : `preventDefault` et
 * `stopPropagation` sur tout ce qu'il reconnaît. C'est ce qui met
 * `usePlayerHotkeys`, qui écoute en bulle sur la fenêtre, hors du chemin — sans
 * quoi une flèche droite déplacerait le curseur fantôme ET sauterait de trente
 * secondes.
 *
 * En mode `osd`, les flèches ne lui appartiennent pas : le moteur de focus a
 * déjà tiré, sur le même nœud, avant lui. Il se contente de les absorber — et
 * sans condition, parce que le moteur peut se retirer de son côté (clavier
 * système à l'écran) : laisser passer dans ce cas rendrait la main à
 * `usePlayerHotkeys`, qui saute de trente secondes.
 *
 * **Une pression physique ne change pas de sens en cours de route.** Une flèche
 * absorbée par l'habillage le reste jusqu'au relâchement, quoi qu'il advienne du
 * mode entre-temps. C'est l'objet de `codeAbsorbedByOsd`, et c'est ce qui
 * empêche un maintien de basculer tout seul dans le flux quand l'habillage
 * s'éteint.
 *
 * **Au repos, une flèche horizontale saute ; tenue, elle déplace.** Le partage
 * appartient au moteur de maintien, qui seul sait distinguer un doigt d'une
 * dalle. Taper doit rester un geste sans conséquence — pas de pause, pas de
 * mode, pas de confirmation à donner : le badge cumule les appuis et le seek
 * différé fait le reste, exactement comme sur le client web.
 *
 * Les touches de transport DÉDIÉES (⏪ ⏩ ▶ ⏸ ⏹) gardent leur fonction quel que
 * soit le mode : elles ne sont pas des flèches détournées, elles ne disent
 * qu'une chose, et une touche dédiée qui ne répond pas se lit comme une panne.
 *
 * La touche Retour n'est PAS traitée ici : elle a sa propre pile de
 * consommateurs, à laquelle le lecteur s'inscrit comme la recherche.
 */

export interface PlayerActionsTv {
  togglePlayback: () => void;
  /** Saut sec, sans allumer l'habillage : le badge suffit à dire ce qui se passe. */
  skip: (delta: number) => void;
  quitter: () => void;
  scrub: ScrubMachine;
}

/**
 * Ce que valent les flèches quand on les tape.
 *
 * Les mêmes valeurs que les boutons de la rangée, et que le client web :
 * l'asymétrie n'est pas un oubli — on revient en arrière pour revoir une
 * réplique, on avance pour passer un passage. Deux gestes de portées
 * différentes.
 */
const SKIP_BACK_S = -10;
const SKIP_FORWARD_S = 30;

/**
 * Les actions sont lues à CHAQUE touche, jamais capturées à l'installation :
 * les rappels du lecteur changent d'identité à chaque rendu, et réattacher un
 * écouteur en capture à chaque image lui ferait manquer des appuis.
 */
export function installTvPlayerKeys(lire: () => PlayerActionsTv): () => void {
  // Le moteur possède l'avance : appui simple comme tic de maintien passent
  // par lui, et lui seul décide du palier. Les actions sont relues à chaque
  // pas, tic compris — un tic qui part une seconde après l'appui doit joindre
  // le lecteur d'alors, pas celui d'avant.
  const engine = createHoldMotor({
    jump: (direction) => lire().skip(direction === 1 ? SKIP_FORWARD_S : SKIP_BACK_S),
    advance: (direction, tier) => lire().scrub.step(direction, tier),
  });

  /**
   * Instant de la dernière sortie de déplacement, pour avaler son écho.
   *
   * Confirmer remet l'habillage à l'écran, boutons compris. La touche qui vient
   * de confirmer est encore enfoncée, la dalle la répète — et cette répétition
   * trouve désormais un bouton focalisé sous elle. Un OK tenu un peu trop
   * longtemps validait la position PUIS mettait la lecture en pause, ce qui n'a
   * l'air d'un défaut de plus que parce qu'on ne voit pas le lien.
   *
   * C'est le même écho qu'`apps/tv` avale sur 400 ms (`SCRUB_TWIN_PRESS_MS`),
   * pour une cause différente — là-bas deux événements pour un seul appui, ici
   * la répétition automatique. La parade est la même.
   */
  let moveEnd = 0;
  const ECHO_SORTIE_MS = 400;

  const echoDeSortie = (): boolean => Date.now() - moveEnd < ECHO_SORTIE_MS;

  /**
   * Code de flèche absorbé par l'habillage, tant qu'on n'a pas levé le doigt.
   *
   * Seconde barrière contre le même défaut, et la seule qui tienne quoi qu'il
   * arrive au minuteur : **un maintien commencé sous l'habillage ne peut pas
   * devenir un déplacement dans le flux**. Il faut relâcher. Sans elle, il
   * suffisait que le mode bascule à `repos` sous la touche pour que la
   * répétition suivante — la même pression physique — soit lue comme un appui
   * neuf, entre en déplacement et mette la vidéo en pause.
   */
  let codeAbsorbedByOsd = 0;

  /**
   * Le mode change AUSSI sans qu'aucune touche n'ait été pressée : le minuteur
   * de masquage l'éteint tout seul. C'est justement ce cas-là qu'aucune garde
   * posée sur le chemin des touches ne pourrait rattraper — d'où l'abonnement.
   */
  let knownMode = readState().mode;
  const unsubscribe = subscribe(() => {
    const mode = readState().mode;
    if (mode === knownMode) return;
    knownMode = mode;
    engine.cancel();
    // Seulement quand l'habillage S'ÉTEINT : ce qui restait d'un double appui
    // n'a plus de sens, on repart d'une flèche qui rallume. Surtout pas sur
    // l'allumage — c'est la flèche elle-même qui vient de le provoquer, et
    // effacer son amorce ici lui retirerait le second appui qu'elle attend.
    if (mode === "idle") arbiter.forget();
  });

  /** Qui possède une flèche horizontale, appui par appui. */
  const arbiter = createArrowArbiter();

  /** Le rallumage en sursis, tant qu'un second appui peut encore l'annuler. */
  let relightWait: ReturnType<typeof setTimeout> | null = null;

  /** La flèche actuellement enfoncée, ou zéro. Effacée au relâchement. */
  let arrowHeld = 0;

  /** Combien de fois on a déjà repoussé le rallumage sur une touche tenue. */
  let grace = 0;

  /** Au-delà, on allume quoi qu'il arrive : la dalle n'émet peut-être pas de `keyup`. */
  const MAX_GRACE = 3;

  const cancelRelight = (): void => {
    if (relightWait === null) return;
    clearTimeout(relightWait);
    relightWait = null;
  };

  /**
   * Ramène les commandes, sauf si le doigt est toujours dessus.
   *
   * Un maintien commence par un appui simple : à l'échéance, on ne sait pas
   * encore si c'en est un — la première répétition, seul signal qui le dise,
   * peut venir après. Tant que la touche n'est pas relâchée, on repousse donc
   * plutôt que d'allumer ; si un déplacement s'engage entre-temps, le
   * changement de mode annulera tout.
   *
   * Le sursis est borné : `keyup` n'est pas garanti sur toutes les dalles, et
   * sans cette borne une touche dont le relâchement se perdrait laisserait le
   * lecteur sans commandes pour de bon.
   */
  const armRelight = (): void => {
    cancelRelight();
    relightWait = setTimeout(() => {
      relightWait = null;
      if (arrowHeld !== 0 && grace < MAX_GRACE) {
        grace += 1;
        armRelight();
        return;
      }
      showOsd();
    }, RELIGHT_DELAY_MS);
  };

  const surTouche = (event: KeyboardEvent): void => {
    const intention = readIntent(event);
    if (!intention || intention.type === "retour") return;

    const state = readState();
    if (!state.mounted) return;

    const actions = lire();
    event.preventDefault();
    event.stopPropagation();

    if (intention.type === "move") {
      const code = event.keyCode;
      arrowHeld = code;

      // Les verticales n'ont jamais servi au transport : sous l'habillage elles
      // parcourent les boutons, au repos elles le ramènent.
      if (!isHorizontal(intention.direction)) {
        if (state.mode === "idle") showOsd();
        else deferAutoHide();
        return;
      }

      // Une surcouche à l'écran — « passer l'intro », « épisode suivant » —
      // propose une action, et les flèches servent alors à la viser. Déplacer
      // la lecture derrière elle reviendrait à répondre à côté de la question.
      //
      // Sous l'habillage, elles continuent de le parcourir — le moteur a déjà
      // tiré avant nous — et l'on garde les commandes à l'écran le temps d'y
      // arriver : c'est le seul chemin vers ce bouton-là, qui ne prend pas le
      // focus quand quelqu'un d'autre s'en sert.
      if (overlayShown()) {
        if (state.mode === "osd") deferAutoHide();
        return;
      }

      switch (arbiter.decide(code, state.mode, event.repeat)) {
        case "wait":
          // On laisse sa chance au second appui : les commandes ne paraissent
          // qu'au terme du délai, et un saut demandé entre-temps les annule.
          grace = 0;
          armRelight();
          return;
        case "focus":
          // Le focus a déjà été déplacé par le moteur, qui a tiré sur ce même
          // nœud avant nous — on ne fait qu'absorber la touche, et garder
          // l'habillage à l'écran tant qu'on le parcourt.
          codeAbsorbedByOsd = code;
          deferAutoHide();
          return;
        default:
          // Un saut est demandé : les commandes n'ont plus à paraître.
          cancelRelight();
          if (code === codeAbsorbedByOsd) return;
          engine.press(code, directionSign(intention.direction), event.repeat);
          return;
      }
    }

    if (intention.type === "select") {
      if (state.mode === "scrub") {
        actions.scrub.confirm();
        moveEnd = Date.now();
        return;
      }
      if (state.mode === "idle") {
        // Une surcouche — bouton « passer », carte « épisode suivant » — paraît
        // alors que l'habillage est éteint et prend le focus. Tant qu'elle le
        // tient, OK lui appartient : c'est le seul geste qui change de
        // propriétaire, les flèches gardent le leur.
        if (enableFocusedOverlay()) return;
        showOsd();
        return;
      }
      if (echoDeSortie()) return;
      enableFocusedElement();
      return;
    }

    // Transport.
    if (intention.command === "arret") {
      if (state.mode === "scrub") actions.scrub.cancel();
      actions.quitter();
      return;
    }

    if (intention.command === "avance" || intention.command === "retour") {
      engine.press(
        event.keyCode,
        intention.command === "avance" ? 1 : -1,
        event.repeat,
      );
      return;
    }

    // Lecture, pause : la touche de transport confirme un scrub en cours plutôt
    // que de reprendre à l'ancienne position — c'est le geste qu'on fait quand
    // on a trouvé où l'on voulait aller.
    if (state.mode === "scrub") {
      actions.scrub.confirm();
      moveEnd = Date.now();
      return;
    }
    if (echoDeSortie()) return;
    actions.togglePlayback();
    showOsd();
  };

  const onRelease = (event: KeyboardEvent): void => {
    // Le doigt s'est levé : la flèche redevient disponible pour le flux.
    if (event.keyCode === arrowHeld) arrowHeld = 0;
    if (event.keyCode === codeAbsorbedByOsd) codeAbsorbedByOsd = 0;
    arbiter.release(event.keyCode);
    engine.release(event.keyCode);
  };

  document.addEventListener("keydown", surTouche, true);
  document.addEventListener("keyup", onRelease, true);

  return () => {
    unsubscribe();
    if (relightWait !== null) clearTimeout(relightWait);
    document.removeEventListener("keydown", surTouche, true);
    document.removeEventListener("keyup", onRelease, true);
    // Sans quoi un tic de maintien survivrait au démontage du lecteur et
    // continuerait de pousser le curseur d'un écran qui n'est plus là.
    engine.destroy();
  };
}

/**
 * Le `preventDefault` ci-dessus a supprimé l'activation native d'Entrée ; on la
 * rejoue explicitement. C'est le parti pris de `FocusableCard` : un clic
 * déclenché à la main est un clic dont on connaît le nombre, là où compter sur
 * la synthèse du moteur en dépend.
 */
function enableFocusedElement(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) active.click();
}
