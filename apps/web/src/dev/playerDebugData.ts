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

import { desktopKind, desktopPlatform } from "../desktop/bridge";
import {
  supportsAppUpdates,
  supportsDownloads,
  supportsMpv,
  supportsOfflineSession,
  supportsSmtc,
} from "../desktop/capabilities";
import { getMpvApi } from "../hooks/mpvRuntime";
import { sectionReseau } from "./playerDebugReseau";
import type { DebugSection } from "./playerDebugTypes";
import { PROPS_VERDICT, verdicts } from "./playerDebugVerdict";
import {
  etatHdrNatif, sectionFenetreChromium, sectionHdrNatif, sectionSurface,
} from "./playerDebugAffichage";
import { derniereSonde, sonder } from "./surfaceProbe";

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

/**
 * Lit un lot de propriétés mpv. Valeur `null` si absente ou refusée.
 *
 * ⚠️ EN PARALLÈLE, et ce n'est pas un raffinement. Sur la coquille Electron
 * macOS, chaque lecture est un aller-retour par la file d'évènements de mpv,
 * vidée toutes les vingt millisecondes. En série, les quarante propriétés du
 * panneau prenaient près d'une seconde — soit plus que l'intervalle de
 * rafraîchissement, et les passes s'empilaient.
 */
async function lireBrut(noms: readonly string[]): Promise<Record<string, string | null>> {
  const api = getMpvApi();
  const sortie: Record<string, string | null> = {};
  if (!api) return sortie;
  const valeurs = await Promise.all(
    noms.map((nom) =>
      api
        .getProperty(nom, "string")
        .then((brut) => (brut === null || brut === undefined ? null : String(brut)))
        .catch(() => null),
    ),
  );
  noms.forEach((nom, i) => {
    sortie[nom] = valeurs[i] ?? null;
  });
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

/** Instantané complet. Une seule passe, appelée par le panneau. */
export async function collecterDebug(): Promise<DebugSection[]> {
  const [pourVerdict, hdr, lecture, natif, surface] = await Promise.all([
    lireBrut(PROPS_VERDICT),
    lire(PROPS_HDR),
    lire(PROPS_LECTURE),
    etatHdrNatif(),
    // La première ouverture capture, les suivantes servent le dernier relevé :
    // une capture par rafraîchissement volerait à la lecture ce qu'on mesure.
    derniereSonde() === null ? sonder() : Promise.resolve(derniereSonde()),
  ]);
  const lignesVerdict = verdicts(pourVerdict, natif?.actif ?? false, natif?.coucheHdr).map(
    (v) => [v.cle, v.valeur, v.bon] as const,
  );
  const sections: Array<DebugSection | null> = [
    { titre: "Ce que tu regardes vraiment", lignes: lignesVerdict, emphase: true },
    // Juste sous les verdicts : pendant une lecture locale, c'est la deuxième
    // chose qu'on veut lire, avant l'inventaire de la coquille.
    sectionReseau(),
    sectionSurface(surface),
    sectionShell(),
    // L'état natif AVANT les requêtes média : sur macOS c'est lui qui fait
    // autorité, et le lire en second faisait conclure sur les mauvaises valeurs.
    sectionHdrNatif(natif),
    sectionFenetreChromium(),
    { titre: "mpv — couleur", lignes: hdr },
    { titre: "mpv — lecture", lignes: lecture },
  ];
  return sections.filter((s): s is DebugSection => s !== null);
}
