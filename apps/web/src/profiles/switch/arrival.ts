import type { CurtainProfile } from "./ProfileCurtain";

/**
 * L'ARRIVÉE dans un profil après le rechargement d'une bascule : le rideau
 * tombé avant le rechargement doit être déjà là au premier rendu, au même
 * nom. Passé par le stockage de SESSION de la fenêtre (il survit au
 * rechargement, pas à la fermeture de l'application), lu UNE fois puis
 * effacé : un rechargement manuel ne le rejoue pas.
 *
 * ⚠️ Clé traversée par une chaîne : jamais renommée.
 */
export const PROFILE_ARRIVAL_KEY = "tentacle_profile_arrival";

export function markArrival(profile: CurtainProfile): void {
  try {
    sessionStorage.setItem(PROFILE_ARRIVAL_KEY, JSON.stringify(profile));
  } catch {
    /* stockage de session indisponible : l'application arrive sans rideau */
  }
}

export function consumeArrival(): CurtainProfile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_ARRIVAL_KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(PROFILE_ARRIVAL_KEY);
    const parsed = JSON.parse(raw) as Partial<CurtainProfile> | null;
    if (!parsed || typeof parsed.id !== "string" || typeof parsed.name !== "string" || typeof parsed.color !== "string") return null;
    return { id: parsed.id, name: parsed.name, color: parsed.color, imageTag: typeof parsed.imageTag === "string" ? parsed.imageTag : null };
  } catch {
    return null;
  }
}
