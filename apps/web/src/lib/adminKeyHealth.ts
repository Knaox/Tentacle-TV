/**
 * La santé de la clé admin Jellyfin — le lecteur vit dans le paquet partagé
 * (`@tentacle-tv/shared`, `notices/adminKeyHealth.ts`) : le mobile l'emploie
 * aussi pour son avertissement. Ce module garde le chemin des imports du web.
 */
export {
  ADMIN_KEY_HEALTH_KEY, readAdminKeyHealth, isAdminKeyBroken,
  type AdminKeyHealth, type AdminKeyState,
} from "@tentacle-tv/shared";
