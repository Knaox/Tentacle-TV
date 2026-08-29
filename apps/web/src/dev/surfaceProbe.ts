/**
 * La sonde de surface, vue depuis la page — DÉVELOPPEMENT UNIQUEMENT.
 *
 * Sur macOS, l'image n'est pas dessinée par Chromium : elle vit dans une
 * fenêtre native de mpv, placée SOUS la surface de la page. Rien de ce que la
 * page peut observer ne dit donc si l'on voit quelque chose — ni une capture du
 * DOM, ni une propriété de mpv. Le processus principal, lui, peut compter les
 * pixels de cette fenêtre (voir `video/macosCapture.ts` côté Electron).
 *
 * Cette porte n'existe que là où la commande est branchée : coquille Electron,
 * macOS, hors paquet livré. Ailleurs, `probeSurface` rend `null` et le panneau
 * n'affiche pas la section.
 */

import { invoke } from "../desktop/bridge";
import { supportsSurfaceProbe } from "../desktop/capabilities";

export interface ImageStats {
  largeur: number;
  hauteur: number;
  /** Part de pixels non noirs, de 0 à 1. */
  nonNoirs: number;
  moyenne: number;
  stdDev: number;
  teintes: number;
}

export interface SurfaceProbe {
  geometrie: string;
  numeroFenetre: number;
  edr: { current: number; potentiel: number };
  image: ImageStats | null;
  error: string | null;
  /** Verdict en clair, calculé côté natif — c'est lui qu'on lit en premier. */
  verdict: string;
}

/**
 * Dernier relevé, servi au panneau entre deux captures.
 *
 * ⚠️ La sonde n'est PAS gratuite : elle capture la fenêtre — seize méga-octets
 * pour une fenêtre ordinaire — pendant une lecture vidéo. Le panneau se
 * rafraîchit deux fois par seconde ; la déclencher à chaque passe volerait à la
 * lecture ce qu'on cherche justement à mesurer. Elle est donc DEMANDÉE (touche
 * C), et le panneau affiche le dernier relevé entre-temps.
 */
let last: SurfaceProbe | null = null;

/** Le dernier relevé, sans rien capturer. */
export function lastProbe(): SurfaceProbe | null {
  return last;
}

/** Interroge la surface. `null` si la coquille ne sait pas le faire. */
export async function probeSurface(): Promise<SurfaceProbe | null> {
  if (!supportsSurfaceProbe()) return null;
  try {
    last = await invoke<SurfaceProbe>("video_surface_probe");
    return last;
  } catch {
    return null;
  }
}

/**
 * Rafraîchit le SEUL headroom EDR, sans rien capturer.
 *
 * ⚠️ Le headroom n'est pas une capacité mais un arbitrage RÉVISABLE : le
 * compositeur le monte par une rampe de plusieurs secondes après le début de la
 * lecture, et le retire dès que la fenêtre cesse d'être visible. Le panneau
 * servait la valeur figée au moment de la dernière capture — il annonçait donc
 * « EDR accordé 1,00 » pendant toute une lecture parfaitement HDR, et il était
 * impossible de prouver le contraire depuis l'interface.
 *
 * Deux lectures de `NSScreen` côté natif, sans capture : appelable à chaque
 * passe du panneau. Rend le relevé complet, EDR à jour, ou `null` s'il n'y a
 * encore rien à mettre à jour.
 */
export async function refreshEdr(): Promise<SurfaceProbe | null> {
  if (last === null || !supportsSurfaceProbe()) return last;
  try {
    last = { ...last, edr: await invoke<SurfaceProbe["edr"]>("video_edr_probe") };
  } catch {
    // Une sonde qui tombe n'apprend rien : on garde le dernier relevé connu.
  }
  return last;
}

/** Le verdict en une ligne, pour le retour d'une action du panneau. */
export function probeVerdict(s: SurfaceProbe | null): string {
  if (s === null) return "sonde de surface indisponible sur cette coquille";
  const edr = `EDR ${s.edr.current.toFixed(2)} / ${s.edr.potentiel.toFixed(2)}`;
  return `${s.verdict} · ${edr}`;
}
