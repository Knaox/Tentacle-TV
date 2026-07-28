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
 * macOS, hors paquet livré. Ailleurs, `sonder` rend `null` et le panneau
 * n'affiche pas la section.
 */

import { invoke } from "../desktop/bridge";
import { supportsSurfaceProbe } from "../desktop/capabilities";

export interface StatistiquesImage {
  largeur: number;
  hauteur: number;
  /** Part de pixels non noirs, de 0 à 1. */
  nonNoirs: number;
  moyenne: number;
  ecartType: number;
  teintes: number;
}

export interface SondeSurface {
  geometrie: string;
  numeroFenetre: number;
  edr: { courant: number; potentiel: number };
  image: StatistiquesImage | null;
  erreur: string | null;
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
let derniere: SondeSurface | null = null;

/** Le dernier relevé, sans rien capturer. */
export function derniereSonde(): SondeSurface | null {
  return derniere;
}

/** Interroge la surface. `null` si la coquille ne sait pas le faire. */
export async function sonder(): Promise<SondeSurface | null> {
  if (!supportsSurfaceProbe()) return null;
  try {
    derniere = await invoke<SondeSurface>("video_surface_probe");
    return derniere;
  } catch {
    return null;
  }
}

/** Le verdict en une ligne, pour le retour d'une action du panneau. */
export function verdictSonde(s: SondeSurface | null): string {
  if (s === null) return "sonde de surface indisponible sur cette coquille";
  const edr = `EDR ${s.edr.courant.toFixed(2)} / ${s.edr.potentiel.toFixed(2)}`;
  return `${s.verdict} · ${edr}`;
}
