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
  // Sur macOS ET Linux ces requêtes ne peuvent RIEN dire de la vidéo — mpv y
  // vit dans une fenêtre native que Chromium ne compose pas, et la page reste
  // une surface SDR même pendant une lecture HDR parfaite : aucun verdict.
  // `desktopPlatform()` vient de la coquille (`process.platform`), pas d'un
  // reniflage d'agent utilisateur.
  const horsChromium = desktopPlatform() === "macos" || desktopPlatform() === "linux";
  const juge = <T,>(v: T): T | null => (horsChromium ? null : v);
  return {
    titre: horsChromium ? "Fenêtre Chromium (ne décrit PAS la vidéo)" : "Écran",
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
  /**
   * Linux : le film est-il TRANSMIS en HDR ? Le verdict du couple
   * video-params / video-target-params, en booléen — `null` quand la question
   * ne se pose pas (contenu SDR, rien relevé, autre plateforme).
   */
  transmission?: boolean | null;
  /** Linux : la plage accordée par le compositeur, en multiples du blanc SDR. */
  pic?: number | null;
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
  const linux = desktopPlatform() === "linux";
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
      : linux
        // Sous Linux la question ne se pose pas à l'écran mais à la SURFACE :
        // le compositeur alloue l'espace colorimétrique surface par surface. Un
        // contenu SDR sort lui aussi en PQ sur un écran laissé en HDR — d'où
        // « sortie » et non « écran », et pas de verdict : c'est la ligne
        // « sortie mpv » plus bas qui tranche. Le pic est l'équivalent du
        // headroom EDR : la plage que le compositeur accorde, en × du blanc SDR.
        ? [
            "sortie en HDR",
            `${etat.actif ? "oui" : "non"}${typeof etat.pic === "number" ? ` · pic ${etat.pic.toFixed(2)}×` : ""}`,
            null,
          ]
        : ["écran en HDR", etat.actif ? "oui" : "non", etat.actif],
  ];
  // macOS SEULEMENT — et le garde-fou est la plateforme, pas la présence du
  // champ : le natif renvoie `edrCapable: false` partout (l'EDR n'existe pas
  // ailleurs), et la ligne s'affichait « non » EN ROUGE sur Windows et Linux —
  // une info macOS qui faisait accuser un défaut inexistant.
  if (mac && etat.edrCapable !== undefined) {
    lignes.push(["écran capable EDR", etat.edrCapable ? "oui" : "non", etat.edrCapable]);
  }
  // L'interrupteur d'écran n'existe que sur Windows : macOS alloue l'EDR
  // fenêtre par fenêtre, Linux négocie la surface au compositeur. La ligne
  // n'apparaît QUE là où il y a un interrupteur — les « sans objet (macOS) »
  // étaient du bruit d'une autre plateforme.
  if (!mac && !linux) {
    lignes.push([
      "bascule d'écran",
      etat.supporte
        ? etat.bascule
          ? "en cours par l'app"
          : "disponible"
        : "indisponible",
      null,
    ]);
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
  // macOS et Linux seulement : Windows n'a ni couche Metal ni sortie négociée,
  // et affichait « couche Metal : inconnue » — une ligne d'une autre plateforme.
  if (etat.coucheHdr !== undefined && (mac || linux)) {
    // La formulation du RENDU, pas celle de l'écran. Sous Linux `espaceCouche`
    // porte déjà le verdict complet — « contenu pq → sortie pq · pic 3,81× », ou
    // « — TONE-MAPPÉ » — et se suffit donc à lui-même.
    const dit = etat.coucheHdr === null ? "inconnue" : etat.coucheHdr ? "plage etendue" : "SDR";
    lignes.push([
      linux ? "sortie mpv" : "couche Metal",
      linux
        ? (etat.espaceCouche ?? "rien relevé")
        : `${dit}${etat.espaceCouche ? ` (${etat.espaceCouche})` : ""}`,
      // Linux : le BOOLÉEN de transmission, pas un reniflage de « TONE-MAPPÉ »
      // dans la chaîne lisible — qui jugeait de plus « bon » un contenu SDR.
      // `null` (SDR, rien relevé) = pas de verdict à porter.
      linux ? (etat.transmission ?? null) : etat.coucheHdr,
    ]);
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
  // Déjà autogardée (la sonde n'existe qu'en dev macOS) ; la déclaration rend
  // la restriction lisible et survivrait à un relâchement de la sonde.
  return { titre: "Surface macOS (C pour recapturer)", lignes, plateformes: ["macos"] };
}
