/**
 * Collecte des informations du lecteur, pour le panneau de diagnostic.
 *
 * DÉVELOPPEMENT UNIQUEMENT. L'appelant est gardé par `import.meta.env.DEV`,
 * que Vite remplace par `false` en production : le module entier disparaît du
 * bundle livré, sans qu'aucune chaîne n'ait à être traduite.
 *
 * Séparé du composant pour tenir la limite de 300 lignes par fichier, et parce
 * que la liste des propriétés est de la donnée, pas de l'affichage.
 */

import { desktopKind, desktopPlatform, invoke } from "../desktop/bridge";
import {
  supportsAppUpdates,
  supportsDownloads,
  supportsMpv,
  supportsOfflineSession,
  supportsSmtc,
} from "../desktop/capabilities";
import { getMpvApi } from "../hooks/mpvRuntime";

/** Une section du panneau. */
export interface DebugSection {
  titre: string;
  lignes: Array<readonly [string, string, boolean | null]>;
}

/**
 * Propriétés mpv relevées, groupées par thème.
 * `null` en troisième position = pas de jugement bon/mauvais à porter.
 */
const PROPS_HDR = [
  "video-params/primaries",
  "video-params/gamma",
  "video-params/sig-peak",
  "video-params/pixelformat",
  "video-params/colormatrix",
  "target-colorspace-hint",
  "target-prim",
  "target-trc",
  "target-peak",
  "tone-mapping",
] as const;

const PROPS_LECTURE = [
  "current-vo",
  "hwdec-current",
  "video-codec",
  "audio-codec",
  "width",
  "height",
  "container-fps",
  "estimated-vf-fps",
  "display-fps",
  "frame-drop-count",
  "demuxer-cache-duration",
  "paused-for-cache",
  "time-pos",
  "duration",
  "pause",
  "volume",
  "mute",
  "aid",
  "sid",
  "path",
] as const;

function attendu(cle: string, valeur: string): boolean | null {
  if (cle === "current-vo") return valeur === "gpu-next";
  if (cle === "hwdec-current") return valeur !== "no" && valeur !== "";
  if (cle === "frame-drop-count") return valeur === "0";
  if (cle === "video-params/gamma") return valeur === "pq" || valeur === "hlg";
  if (cle === "video-params/primaries") return valeur === "bt.2020";
  return null;
}

async function lire(noms: readonly string[]): Promise<DebugSection["lignes"]> {
  const api = getMpvApi();
  if (!api) return [["mpv", "adaptateur non chargé", false]];
  const lignes: Array<readonly [string, string, boolean | null]> = [];
  for (const nom of noms) {
    let valeur = "—";
    try {
      const brut = await api.getProperty(nom, "string");
      valeur = brut === null || brut === undefined ? "—" : String(brut);
    } catch {
      valeur = "n/d";
    }
    lignes.push([nom, valeur, valeur === "—" || valeur === "n/d" ? null : attendu(nom, valeur)]);
  }
  return lignes;
}

/** Ce que le navigateur sait de l'écran — c'est le capteur de la bascule HDR. */
function sectionEcran(): DebugSection {
  const hdr = matchMedia("(dynamic-range: high)").matches;
  const videoHdr = matchMedia("(video-dynamic-range: high)").matches;
  const rec2020 = matchMedia("(color-gamut: rec2020)").matches;
  const p3 = matchMedia("(color-gamut: p3)").matches;
  return {
    titre: "Écran",
    lignes: [
      ["dynamic-range", hdr ? "high" : "standard", hdr],
      ["video-dynamic-range", videoHdr ? "high" : "standard", videoHdr],
      ["color-gamut", rec2020 ? "rec2020" : p3 ? "p3" : "srgb", rec2020 || p3],
      ["colorDepth", `${screen.colorDepth} bits`, null],
      ["devicePixelRatio", String(devicePixelRatio), null],
      ["fenêtre", `${innerWidth}x${innerHeight}`, null],
      ["écran", `${screen.width}x${screen.height}`, null],
    ],
  };
}

function sectionShell(): DebugSection {
  return {
    titre: "Coquille",
    lignes: [
      ["shell", desktopKind() ?? "web", desktopKind() !== null],
      ["plateforme", desktopPlatform(), null],
      ["lecteur mpv", supportsMpv() ? "disponible" : "absent", supportsMpv()],
      ["téléchargements", supportsDownloads() ? "disponible" : "absent", supportsDownloads()],
      ["contrôles média", supportsSmtc() ? "disponible" : "absent", supportsSmtc()],
      ["mises à jour", supportsAppUpdates() ? "disponible" : "absent", supportsAppUpdates()],
      ["session hors ligne", supportsOfflineSession() ? "disponible" : "absent", supportsOfflineSession()],
      ["adaptateur mpv", getMpvApi() ? "chargé" : "non chargé", getMpvApi() !== null],
    ],
  };
}

/** État HDR vu par le NATIF, plus fiable que la requête média du navigateur. */
async function sectionHdrNatif(): Promise<DebugSection> {
  try {
    const etat = await invoke<{ actif: boolean; bascule: boolean }>("display_hdr_state");
    return {
      titre: "HDR — état natif",
      lignes: [
        ["écran en HDR", etat.actif ? "oui" : "non", etat.actif],
        ["basculé par l'app", etat.bascule ? "oui" : "non", null],
      ],
    };
  } catch {
    return { titre: "HDR — état natif", lignes: [["commande", "indisponible", false]] };
  }
}

/** Instantané complet. Une seule passe, appelée par le panneau. */
export async function collecterDebug(): Promise<DebugSection[]> {
  const [hdr, lecture, natif] = await Promise.all([
    lire(PROPS_HDR),
    lire(PROPS_LECTURE),
    sectionHdrNatif(),
  ]);
  return [
    sectionShell(),
    sectionEcran(),
    natif,
    { titre: "mpv — couleur", lignes: hdr },
    { titre: "mpv — lecture", lignes: lecture },
  ];
}
