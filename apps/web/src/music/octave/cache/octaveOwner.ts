/**
 * Octave — À QUI appartient ce que l'appareil garde de la musique : le serveur
 * et le compte de la session gardée (un profil de la Famille compris), lus
 * dans `tentacle_user`. Sans session : personne, rien de gardé ni de rendu.
 */

import { getBackendBase } from "../../../lib/backendBase";

export function octaveOwner(): string | null {
  try {
    const raw = localStorage.getItem("tentacle_user");
    const id = raw ? (JSON.parse(raw) as { Id?: unknown }).Id : null;
    return typeof id === "string" && id ? `${getBackendBase()}|${id}` : null;
  } catch {
    return null;
  }
}
