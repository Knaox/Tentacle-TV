// Ce que la neutralisation fait de chaque colonne sensible (cœur + Vigie, schéma 1.24).
// Tout le reste passe tel quel, SAUF les remplacements globaux (identifiants de comptes,
// noms d'hôtes et adresses de la production) appliqués à toute valeur texte.

/** Nom d'un compte → nom du compte du banc lié à la ligne (colonne d'identifiant). */
export const NAME_COLUMNS = {
  invite_usages: { username: "jellyfinUserId" },
  paired_devices: { username: "jellyfinUserId" },
  pairing_codes: { username: "jellyfinUserId" },
  provisioning_codes: { username: "jellyfinUserId" },
  seer_requests: { username: "jellyfin_user_id" },
  seer_user_settings: { username: "jellyfin_user_id" },
  share_links: { ownerUsername: "ownerUserId" },
  support_tickets: { username: "jellyfinUserId" },
  ticket_messages: { username: "jellyfinUserId" },
  families: { ownerName: "ownerUserId" },
  family_invitations: { inviteeName: "inviteeUserId" },
  family_members: { displayName: "userId", jellyfinName: "userId" },
  guest_account_cleanups: { jellyfinName: "jellyfinUserId" },
};

/** Secrets, jetons, codes : un factice de même forme (même valeur → même factice). */
export const SECRET_COLUMNS = {
  paired_devices: ["tokenHash", "legacyTokenHash", "jellyfinAccessToken", "jellyfinDeviceId"],
  paired_device_cleanups: ["jellyfinDeviceId", "tokenHash"],
  pairing_codes: ["code", "token", "jellyfinAccessToken", "deviceId"],
  provisioning_codes: ["code", "token", "jellyfinAccessToken"],
  push_devices: ["expoPushToken"],
  invite_keys: ["key"],
  share_links: ["token"],
  external_accounts: ["guestSessionId"],
};

/** Noms d'appareils (souvent « iPhone de … ») → « Appareil N ». */
export const DEVICE_NAME_COLUMNS = {
  paired_devices: ["name"],
  pairing_codes: ["deviceName"],
  watch_segments: ["deviceName"],
};

/** Texte libre écrit par une personne → texte de test numéroté. */
export const FREE_TEXT_COLUMNS = {
  support_tickets: { subject: "Ticket de test" },
  ticket_messages: { body: "Message de test" },
};

/** Clés de `server_config` qui désignent la production ou en sont les secrets. */
export const CONFIG_REWRITE = {
  jellyfin_url: (b) => b.jellyfinUrl,
  jellyfin_private_url: (b) => b.jellyfinUrl,
  jellyfin_public_url: () => "http://jellyfin.sqlbench.test",
  public_url: (b) => b.publicUrl,
  jellyfin_api_key: (b) => b.apiKey,
  admin_username: (b) => b.admin.name,
};
/** Clés régénérées (même forme, autre tirage). */
export const CONFIG_REGENERATE = ["jwt_secret", "device_id_secret", "tmdb_api_key", "install_id"];

/**
 * Tables de CACHE : contenu public (TMDB) ou dérivé, jamais lié à un compte. Les noms de
 * personnes n'y sont pas cherchés (un prénom y est un mot d'un résumé de film) ; les
 * identifiants, hôtes et adresses, si.
 */
export const CACHE_TABLES = new Set([
  "tmdb_meta_cache",
  "seer_tmdb_cache",
  "seer_search_titles",
  "seer_search_meta",
  "facet_idf",
  "item_cooccurrences",
  "library_known_id",
  "media_audio_analysis",
  "media_frame_analysis",
]);

/** Le PIN de profil du banc (aucune valeur réelle : le PIN d'origine est remplacé). */
export const BENCH_PIN = "1357";
