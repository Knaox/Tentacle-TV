import type { KeyValueStore } from "@tentacle-tv/shared";
import { personalToken, readActiveProfile } from "./profileSessionCore";
import { forgetMobileProfileSession } from "./switchSession";

/** La déconnexion n'attend jamais plus que ça un serveur muet. */
const LOGOUT_BUDGET_MS = 3000;

/**
 * Avant de se déconnecter du COMPTE pendant une session de profil : le serveur
 * en est prévenu par la session PERSONNELLE (`POST /api/auth/logout` en
 * Bearer), qui coupe les sessions de profil de l'appareil avant de répondre —
 * comme le bureau (`useAccountLogout`). Puis la session de profil s'oublie
 * localement (marque et réserve du compte, trousseau compris). Hors d'une
 * session de profil : rien, la déconnexion d'avant suit telle quelle.
 */
export async function endAccountProfiles(storage: KeyValueStore, serverUrl: string | null): Promise<void> {
  if (!readActiveProfile(storage)) return;
  const token = personalToken(storage);
  if (token && serverUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOGOUT_BUDGET_MS);
    try {
      await fetch(`${serverUrl.replace(/\/$/, "")}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
    } catch {
      /* serveur muet : la purge locale suit quand même */
    } finally {
      clearTimeout(timer);
    }
  }
  forgetMobileProfileSession(storage);
}
