import { useEffect } from "react";
import { PROFILE_SESSION_KEY } from "./profileSession";

/**
 * Le NAVIGATEUR a plusieurs onglets, le bureau une fenêtre : stockage et
 * cookies sont communs à tous. Quand un onglet change de profil (entrer,
 * revenir à son compte, passer à un autre), le serveur voit déjà les AUTRES
 * onglets sous la nouvelle session — ils rechargent donc aussitôt, au lieu de
 * garder l'interface (droits, administration, compte) de l'ancienne.
 *
 * Seule la marque du profil compte : une déconnexion dans un autre onglet suit
 * son chemin d'avant (le 401 de la garde de session).
 */
function profileIdOf(raw: string | null): string | null {
  try {
    const id = raw ? (JSON.parse(raw) as { id?: unknown }).id : null;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/** Le profil a-t-il changé (pas seulement sa photo, réécrite dans la même marque) ? */
export function profileChangedElsewhere(event: Pick<StorageEvent, "key" | "oldValue" | "newValue">): boolean {
  return event.key === PROFILE_SESSION_KEY && profileIdOf(event.oldValue) !== profileIdOf(event.newValue);
}

export function useCrossTabProfileReload(): void {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (profileChangedElsewhere(event)) window.location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
