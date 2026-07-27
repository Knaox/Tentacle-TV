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
import { requetesSortantes, type RequeteSortante } from "./networkProbe";
import { PROPS_VERDICT, verdicts } from "./playerDebugVerdict";

/** Une section du panneau. */
export interface DebugSection {
  titre: string;
  lignes: Array<readonly [string, string, boolean | null]>;
  /** Section de tête : rendue plus grande, c'est ce qu'on lit en premier. */
  emphase?: boolean;
}

/**
 * Propriétés mpv relevées, groupées par thème.
 * `null` en troisième position = pas de jugement bon/mauvais à porter.
 */
/**
 * Deux familles à ne PAS confondre.
 *
 * `video-params/*` décrit la SOURCE, `video-target-params/*` ce qui part
 * réellement vers l'écran après conversion. Les `target-*` nus, eux, ne sont
 * que des RÉGLAGES : ils valent « auto » en fonctionnement normal, et les lire
 * comme une sortie fait conclure à tort à un tone-mapping.
 */
const PROPS_HDR = [
  "video-params/primaries",
  "video-params/gamma",
  "video-params/sig-peak",
  "video-params/pixelformat",
  "video-params/colormatrix",
  "video-target-params/primaries",
  "video-target-params/gamma",
  "video-target-params/sig-peak",
  "target-colorspace-hint",
  "target-prim",
  "target-trc",
  "target-peak",
  "tone-mapping",
] as const;

const PROPS_LECTURE = [
  "current-vo",
  // Laissés à `auto` : mpv choisit d3d11 sous Windows, et c'est CE backend qui
  // implémente `target-colorspace-hint`. On les lit plutôt que de les figer —
  // pinner priverait de repli les machines où d3d11 n'est pas disponible.
  "gpu-api",
  "gpu-context",
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
  "demuxer-via-network",
  "cache-speed",
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
  // La SORTIE effective : c'est elle qui dit si le HDR arrive vraiment à l'écran.
  if (cle === "video-target-params/gamma") return valeur === "pq" || valeur === "hlg";
  if (cle === "video-target-params/primaries") return valeur === "bt.2020";
  return null;
}

/** Lit un lot de propriétés mpv. Valeur `null` si absente ou refusée. */
async function lireBrut(noms: readonly string[]): Promise<Record<string, string | null>> {
  const api = getMpvApi();
  const sortie: Record<string, string | null> = {};
  if (!api) return sortie;
  for (const nom of noms) {
    try {
      const brut = await api.getProperty(nom, "string");
      sortie[nom] = brut === null || brut === undefined ? null : String(brut);
    } catch {
      sortie[nom] = null;
    }
  }
  return sortie;
}

async function lire(noms: readonly string[]): Promise<DebugSection["lignes"]> {
  if (!getMpvApi()) return [["mpv", "adaptateur non chargé", false]];
  const brut = await lireBrut(noms);
  return noms.map((nom) => {
    const valeur = brut[nom] ?? "—";
    return [nom, valeur, valeur === "—" ? null : attendu(nom, valeur)] as const;
  });
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
async function etatHdrNatif(): Promise<{ actif: boolean; bascule: boolean } | null> {
  try {
    return await invoke<{ actif: boolean; bascule: boolean }>("display_hdr_state");
  } catch {
    return null;
  }
}

function sectionHdrNatif(etat: { actif: boolean; bascule: boolean } | null): DebugSection {
  if (etat === null) {
    return { titre: "HDR — état natif", lignes: [["commande", "indisponible", false]] };
  }
  return {
    titre: "HDR — état natif",
    lignes: [
      ["écran en HDR", etat.actif ? "oui" : "non", etat.actif],
      ["basculé par l'app", etat.bascule ? "oui" : "non", null],
    ],
  };
}

function heure(at: number): string {
  const d = new Date(at);
  const deuxChiffres = (n: number): string => String(n).padStart(2, "0");
  return `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}:${deuxChiffres(d.getSeconds())}`;
}

/**
 * Chemin lisible : l'origine tombe, le jeton aussi.
 *
 * ⚠️ Les URL de sous-titres de Jellyfin portent la clé d'API EN QUERY. Ce
 * panneau se photographie et se colle dans une conversation — la masquer ici
 * évite qu'elle voyage avec la capture.
 */
function chemin(url: string): string {
  let court = url;
  try {
    const u = new URL(url);
    court = u.pathname + u.search;
  } catch {
    /* URL relative : déjà un chemin */
  }
  court = court.replace(/([?&](api_key|token|X-Emby-Token)=)[^&]*/gi, "$1***");
  return court.length > 88 ? `${court.slice(0, 87)}…` : court;
}

function fautif(r: RequeteSortante): boolean {
  return r.echec || (r.status !== null && r.status >= 400);
}

function etat(r: RequeteSortante): string {
  if (r.echec) return `ECHEC RESEAU (${r.dureeMs ?? "?"} ms)`;
  if (r.status === null) return "en vol…";
  return `${r.status} · ${r.dureeMs ?? "?"} ms`;
}

/**
 * Ce qui est SORTI de la page vers le serveur.
 *
 * Le vide est une information, et c'est même LA réponse qu'on cherche pendant
 * une lecture locale : la touche R remet le journal à zéro juste avant de
 * lancer le film, et ce qui apparaît ensuite est exactement ce que la lecture
 * a provoqué — segments d'intro et d'outro compris.
 */
function sectionReseau(): DebugSection {
  const requetes = requetesSortantes();
  if (requetes.length === 0) {
    return {
      titre: "Réseau sortant (R pour vider)",
      lignes: [["depuis la remise à zéro", "rien n'est sorti", true]],
    };
  }
  const echecs = requetes.filter(fautif).length;
  const entete: DebugSection["lignes"][number] = [
    "depuis la remise à zéro",
    `${requetes.length} requête${requetes.length > 1 ? "s" : ""}${echecs > 0 ? `, ${echecs} en échec` : ""}`,
    echecs === 0,
  ];
  // Les plus récentes en tête : c'est ce qu'on vient de provoquer qu'on lit.
  const recentes = requetes
    .slice(-12)
    .reverse()
    .map(
      (r) =>
        [`${heure(r.at)} ${r.methode}`, `${chemin(r.url)} → ${etat(r)}`, fautif(r) ? false : null] as const,
    );
  return { titre: "Réseau sortant (R pour vider)", lignes: [entete, ...recentes] };
}

/** Instantané complet. Une seule passe, appelée par le panneau. */
export async function collecterDebug(): Promise<DebugSection[]> {
  const [pourVerdict, hdr, lecture, natif] = await Promise.all([
    lireBrut(PROPS_VERDICT),
    lire(PROPS_HDR),
    lire(PROPS_LECTURE),
    etatHdrNatif(),
  ]);
  const lignesVerdict = verdicts(pourVerdict, natif?.actif ?? false).map(
    (v) => [v.cle, v.valeur, v.bon] as const,
  );
  return [
    { titre: "Ce que tu regardes vraiment", lignes: lignesVerdict, emphase: true },
    // Juste sous les verdicts : pendant une lecture locale, c'est la deuxième
    // chose qu'on veut lire, avant l'inventaire de la coquille.
    sectionReseau(),
    sectionShell(),
    sectionEcran(),
    sectionHdrNatif(natif),
    { titre: "mpv — couleur", lignes: hdr },
    { titre: "mpv — lecture", lignes: lecture },
  ];
}
