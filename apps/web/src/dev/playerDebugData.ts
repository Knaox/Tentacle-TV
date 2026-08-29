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

import { desktopKind, desktopPlatform, montageLinux } from "../desktop/bridge";
import {
  supportsAppUpdates,
  supportsDownloads,
  supportsMpv,
  supportsOfflineSession,
  supportsSmtc,
} from "../desktop/capabilities";
import { getMpvApi } from "../hooks/mpvRuntime";
import { mpvDisabledByDebug } from "../lib/nativePlayer";
import { startupSection } from "./playerDebugStartup";
import { networkSection } from "./playerDebugNetwork";
import type { DebugSection } from "./playerDebugTypes";
import { VERDICT_PROPS, verdicts } from "./playerDebugVerdict";
import {
  nativeHdrState, chromiumWindowSection, nativeHdrSection, surfaceSection,
} from "./playerDebugDisplay";
import { lastProbe, refreshEdr, probeSurface } from "./surfaceProbe";

/**
 * Propriétés mpv relevées, groupées par thème. Deux familles à ne PAS confondre.
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

const PLAYBACK_PROPS = [
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
  // Les deux réglages qui décident du démarrage. Lus, et pas supposés : la
  // coquille Electron écarte EN SILENCE toute option d'init qu'elle ne connaît
  // pas (`mpvAllowlist.ts`) — une option qu'on croit posée peut n'avoir jamais
  // atteint mpv, et c'est indiscernable à l'œil.
  "cache-pause-initial",
  "cache-pause-wait",
  "time-pos",
  "duration",
  "pause",
  "volume",
  "mute",
  "aid",
  "sid",
  "path",
] as const;

function expected(key: string, value: string): boolean | null {
  if (key === "current-vo") return value === "gpu-next";
  if (key === "cache-pause-initial") return value === "yes";
  if (key === "hwdec-current") return value !== "no" && value !== "";
  if (key === "frame-drop-count") return value === "0";
  if (key === "video-params/gamma") return value === "pq" || value === "hlg";
  if (key === "video-params/primaries") return value === "bt.2020";
  // La SORTIE effective : c'est elle qui dit si le HDR arrive vraiment à l'écran.
  if (key === "video-target-params/gamma") return value === "pq" || value === "hlg";
  if (key === "video-target-params/primaries") return value === "bt.2020";
  return null;
}

/**
 * Lit un lot de propriétés mpv. Valeur `null` si absente ou refusée.
 *
 * ⚠️ EN PARALLÈLE, et ce n'est pas un raffinement. Sur la coquille Electron
 * macOS, chaque lecture est un aller-retour par la file d'évènements de mpv,
 * vidée toutes les vingt millisecondes. En série, les quarante propriétés du
 * panneau prenaient près d'une seconde — soit plus que l'intervalle de
 * rafraîchissement, et les passes s'empilaient.
 */
async function readRaw(names: readonly string[]): Promise<Record<string, string | null>> {
  const api = getMpvApi();
  const output: Record<string, string | null> = {};
  if (!api) return output;
  const values = await Promise.all(
    names.map((name) =>
      api
        .getProperty(name, "string")
        .then((raw) => (raw === null || raw === undefined ? null : String(raw)))
        .catch(() => null),
    ),
  );
  names.forEach((name, i) => {
    output[name] = values[i] ?? null;
  });
  return output;
}

async function readProp(names: readonly string[]): Promise<DebugSection["lines"]> {
  if (!getMpvApi()) return [["mpv", "adaptateur non chargé", false]];
  const raw = await readRaw(names);
  return names.map((name) => {
    const value = raw[name] ?? "—";
    return [name, value, value === "—" ? null : expected(name, value)] as const;
  });
}

function shellSection(): DebugSection {
  return {
    title: "Coquille",
    lines: [
      ["shell", desktopKind() ?? "web", desktopKind() !== null],
      ["plateforme", desktopPlatform(), null],
      // Sous Linux, `plateforme` ne dit pas l'essentiel : c'est le montage qui
      // décide du HDR et de la lecture plein écran. Absent ailleurs.
      ...(montageLinux() === null
        ? []
        : ([[
            "montage vidéo",
            montageLinux() === "wayland"
              ? "wayland — HDR possible, lecture plein écran"
              : "x11 — lecture fenêtrée, pas de HDR",
            null,
          ]] as const)),
      // Trois états : l'interrupteur de debug (touche M) prime — dire
      // « disponible » pendant qu'il est coupé ferait chercher un défaut.
      mpvDisabledByDebug()
        ? (["lecteur mpv", "désactivé (debug, touche M)", false] as const)
        : (["lecteur mpv", supportsMpv() ? "disponible" : "absent", supportsMpv()] as const),
      ["téléchargements", supportsDownloads() ? "disponible" : "absent", supportsDownloads()],
      ["contrôles média", supportsSmtc() ? "disponible" : "absent", supportsSmtc()],
      ["mises à jour", supportsAppUpdates() ? "disponible" : "absent", supportsAppUpdates()],
      ["session hors ligne", supportsOfflineSession() ? "disponible" : "absent", supportsOfflineSession()],
      ["adaptateur mpv", getMpvApi() ? "chargé" : "non chargé", getMpvApi() !== null],
    ],
  };
}

/** Instantané complet. Une seule passe, appelée par le panneau. */
export async function collectDebug(): Promise<DebugSection[]> {
  const [forVerdict, hdr, playback, native, surface] = await Promise.all([
    readRaw(VERDICT_PROPS),
    readProp(PROPS_HDR),
    readProp(PLAYBACK_PROPS),
    nativeHdrState(),
    // La première ouverture capture ; les suivantes ne rafraîchissent que le
    // headroom EDR. Une capture par passe volerait à la lecture ce qu'on mesure
    // (seize méga-octets), mais l'EDR ne coûte que deux lectures de `NSScreen` —
    // et le laisser figé faisait annoncer « EDR accordé 1,00 » pendant toute une
    // lecture HDR, le compositeur ne l'accordant qu'au bout d'une rampe de
    // plusieurs secondes. Voir `refreshEdr`.
    lastProbe() === null ? probeSurface() : refreshEdr(),
  ]);
  const verdictLines = verdicts(forVerdict, native?.enabled ?? false, native?.coucheHdr).map(
    (v) => [v.key, v.value, v.good] as const,
  );
  const sections: Array<DebugSection | null> = [
    { title: "Ce que tu regardes vraiment", lines: verdictLines, emphasis: true },
    // Juste après les verdicts : une coupure au démarrage se juge sur sa
    // chronologie, et elle est déjà passée quand on ouvre le panneau — la
    // reléguer en bas obligeait à faire défiler pendant que le film tourne.
    startupSection(),
    // Puis le réseau : pendant une lecture locale, c'est la chose suivante
    // qu'on veut lire, avant l'inventaire de la coquille.
    networkSection(),
    surfaceSection(surface),
    shellSection(),
    // L'état natif AVANT les requêtes média : sur macOS c'est lui qui fait
    // autorité, et le lire en second faisait conclure sur les mauvaises valeurs.
    nativeHdrSection(native),
    chromiumWindowSection(),
    { title: "mpv — couleur", lines: hdr },
    { title: "mpv — lecture", lines: playback },
  ];
  // Le filtre plateforme est ICI, pas dans chaque section : une section qui se
  // déclare (`platforms`) n'a pas à savoir où elle tourne.
  return sections.filter(
    (s): s is DebugSection => s !== null && (s.platforms?.includes(desktopPlatform()) ?? true),
  );
}
