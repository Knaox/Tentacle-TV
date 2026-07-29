/**
 * Écran, HDR natif et surface — les sections du panneau de diagnostic qui
 * décrivent l'AFFICHAGE plutôt que mpv.
 *
 * Extraites de `playerDebugData` (limite de 300 lignes par fichier), et elles
 * vont ensemble : sur macOS, savoir ce que la vidéo montre vraiment demande de
 * confronter trois sources qui ne parlent pas de la même chose — les requêtes
 * média de Chromium (sa fenêtre à lui), l'état HDR rapporté par le natif (la
 * fenêtre vidéo), et la sonde qui compte les pixels.
 *
 * DÉVELOPPEMENT UNIQUEMENT, comme le reste de `dev/`.
 */

import { desktopPlatform, invoke } from "../desktop/bridge";
import type { DebugSection } from "./playerDebugTypes";
import type { SondeSurface } from "./surfaceProbe";

/**
 * Ce que Chromium sait — de SA fenêtre, et de rien d'autre.
 *
 * # Pourquoi cette section ne s'appelle plus « Écran »
 *
 * Ces requêtes média décrivent la fenêtre qui affiche la PAGE. Sous Windows,
 * cela renseigne bien sur l'écran : le mode HDR y est un interrupteur global,
 * donc quand il est actif la page le voit aussi.
 *
 * Sur macOS, non — et c'était trompeur au point de désigner un défaut qui
 * n'existe pas. L'EDR y est accordé FENÊTRE PAR FENÊTRE par le compositeur, et
 * la vidéo vit dans une NSWindow séparée que Chromium ne compose pas. La page,
 * elle, est de l'interface SDR : `dynamic-range` y vaut donc `standard` en
 * permanence, y compris pendant une lecture HDR parfaite. Marquer cette ligne
 * d'un verdict revenait à afficher une croix rouge à côté d'une lecture
 * irréprochable, et à faire accuser l'écran.
 *
 * Sur macOS, l'autorité est la section « HDR — état natif » juste en dessous, et
 * la sonde de surface au-dessus. Les valeurs restent affichées — elles sont
 * vraies pour la page — mais sans verdict, et la section dit de quoi elle parle.
 */
export function sectionFenetreChromium(): DebugSection {
  const hdr = matchMedia("(dynamic-range: high)").matches;
  const videoHdr = matchMedia("(video-dynamic-range: high)").matches;
  const rec2020 = matchMedia("(color-gamut: rec2020)").matches;
  const p3 = matchMedia("(color-gamut: p3)").matches;
  // Sur macOS ces requêtes ne peuvent RIEN dire de la vidéo : aucun verdict.
  // `desktopPlatform()` vient de la coquille (`process.platform`), pas d'un
  // reniflage d'agent utilisateur.
  const mac = desktopPlatform() === "macos";
  const juge = <T,>(v: T): T | null => (mac ? null : v);
  return {
    titre: mac ? "Fenêtre Chromium (ne décrit PAS la vidéo)" : "Écran",
    lignes: [
      ["dynamic-range", hdr ? "high" : "standard", juge(hdr)],
      ["video-dynamic-range", videoHdr ? "high" : "standard", juge(videoHdr)],
      ["color-gamut", rec2020 ? "rec2020" : p3 ? "p3" : "srgb", juge(rec2020 || p3)],
      ["colorDepth", `${screen.colorDepth} bits`, null],
      ["devicePixelRatio", String(devicePixelRatio), null],
      ["fenêtre", `${innerWidth}x${innerHeight} pts`, null],
      // `screen.*` est en points CSS. Sur un écran Retina, l'afficher seul faisait
      // lire 1512x982 pour un panneau qui en a 3024x1964 — la valeur réelle est
      // le produit par la densité, et les deux méritent d'être là.
      [
        "écran",
        `${screen.width}x${screen.height} pts · ${Math.round(screen.width * devicePixelRatio)}x${Math.round(screen.height * devicePixelRatio)} px`,
        null,
      ],
    ],
  };
}



/**
 * Ce que le natif sait de l'écran — TOUT ce qu'il en dit.
 *
 * La coquille renvoie sept champs ; le panneau n'en lisait que quatre, et les
 * trois oubliés sont justement ceux qui expliquent le comportement sur macOS :
 * `supporte` (y a-t-il un interrupteur d'écran à basculer ? jamais sur macOS) et
 * `autoAutorise` (la transmission du signal HDR est-elle permise ? c'est ce
 * réglage-là qui compte sur macOS).
 */
interface EtatHdrNatif {
  actif: boolean;
  bascule: boolean;
  /** L'écran a-t-il un mode HDR à basculer ? Faux sur macOS : il n'en a pas. */
  supporte?: boolean;
  /** La transmission du signal HDR par mpv est-elle autorisée ? */
  autoAutorise?: boolean;
  edrCapable?: boolean;
  /** La couche Metal de mpv, telle que mpv la rapporte. `null` = il n'a rien dit. */
  coucheHdr?: boolean | null;
  espaceCouche?: string | null;
}

/** État HDR vu par le NATIF, plus fiable que la requête média du navigateur. */
export async function etatHdrNatif(): Promise<EtatHdrNatif | null> {
  try {
    return await invoke<EtatHdrNatif>("display_hdr_state");
  } catch {
    return null;
  }
}

export function sectionHdrNatif(etat: EtatHdrNatif | null): DebugSection {
  if (etat === null) {
    return { titre: "HDR — état natif", lignes: [["commande", "indisponible", false]] };
  }
  const mac = desktopPlatform() === "macos";
  const lignes: DebugSection["lignes"] = [
    // Le même champ ne dit pas la même chose des deux côtés, et le libellé
    // unique faisait mal lire les deux. Windows : l'écran EST en mode HDR, un
    // état stable du bureau. macOS : la plage étendue est accordée EN CE MOMENT à
    // la fenêtre vidéo, ce qui dépend de l'image — une scène de nuit ne réclame
    // aucune haute lumière et fait retomber la valeur sur une lecture pourtant
    // parfaite (mesuré sur le même film : 1,00 puis 12,82). D'où l'absence de
    // verdict sur macOS : ce n'est pas un défaut, c'est une scène sombre.
    mac
      ? ["plage étendue accordée (instantané)", etat.actif ? "oui" : "non", null]
      : ["écran en HDR", etat.actif ? "oui" : "non", etat.actif],
  ];
  // macOS seulement, et à ne PAS confondre avec la ligne du dessus : « l'écran
  // SAIT faire de la plage étendue » n'est pas « il en reçoit en ce moment ».
  // Le natif le renvoyait déjà, le panneau n'en faisait rien.
  if (etat.edrCapable !== undefined) {
    lignes.push(["écran capable EDR", etat.edrCapable ? "oui" : "non", etat.edrCapable]);
  }
  // L'interrupteur d'écran n'existe que sur Windows. Afficher « basculé par
  // l'app : non » sur macOS laissait croire à une bascule ratée, alors qu'il n'y
  // a rien à basculer — le compositeur alloue l'EDR fenêtre par fenêtre.
  if (etat.supporte !== undefined) {
    lignes.push([
      "bascule d'écran",
      etat.supporte ? (etat.bascule ? "en cours par l'app" : "disponible") : "sans objet (macOS)",
      null,
    ]);
  } else {
    lignes.push(["basculé par l'app", etat.bascule ? "oui" : "non", null]);
  }
  // LE réglage qui compte sur macOS : sans lui, mpv ne transmet pas le signal.
  if (etat.autoAutorise !== undefined) {
    lignes.push([
      "transmission HDR autorisée",
      etat.autoAutorise ? "oui" : "non (touche H)",
      etat.autoAutorise,
    ]);
  }
  // Ce que mpv dit de SA couche — la seule mesure qui ne dépende pas de la
  // scène affichée, contrairement à « écran en HDR » juste au-dessus.
  if (etat.coucheHdr !== undefined) {
    const dit = etat.coucheHdr === null ? "inconnue" : etat.coucheHdr ? "plage etendue" : "SDR";
    lignes.push(["couche Metal", `${dit}${etat.espaceCouche ? ` (${etat.espaceCouche})` : ""}`, etat.coucheHdr]);
  }
  return { titre: "HDR — état natif", lignes };
}

/**
 * Ce que l'écran montre vraiment — la seule section qui ne croit pas mpv.
 *
 * Absente hors coquille Electron macOS en développement : la sonde y est la
 * seule à pouvoir compter les pixels d'une fenêtre qui n'appartient pas à
 * Chromium. Voir `surfaceProbe.ts`.
 */
export function sectionSurface(s: SondeSurface | null): DebugSection | null {
  if (s === null) return null;
  const lignes: DebugSection["lignes"] = [
    ["verdict", s.verdict, s.image !== null && s.erreur === null ? s.verdict.startsWith("IMAGE") : null],
    ["EDR accordé", s.edr.courant.toFixed(2), s.edr.courant > 1.01],
    ["EDR potentiel", s.edr.potentiel.toFixed(2), null],
    ["fenêtre vidéo", s.numeroFenetre === 0 ? "aucune" : String(s.numeroFenetre), s.numeroFenetre !== 0],
    ["géométrie", s.geometrie, null],
  ];
  if (s.image !== null) {
    lignes.push(["capture", `${String(s.image.largeur)}x${String(s.image.hauteur)}`, null]);
  }
  return { titre: "Surface macOS (C pour recapturer)", lignes };
}
