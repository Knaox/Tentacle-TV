// Où vivent les identifiants de COMPTES Jellyfin dans la base de Tentacle (cœur + Vigie).
// Jellyfin les écrit en 32 hexadécimaux ; une forme à tirets (GUID) est reconnue aussi.
export const ID_PATTERN = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const BY_TABLE = {
  families: ["ownerUserId"],
  family_invitations: ["ownerUserId", "inviteeUserId"],
  family_members: ["userId", "createdBy"],
  profile_pins: ["userId"],
  profile_pin_attempts: ["userId"],
  invite_keys: ["createdBy"],
  paired_devices: ["stickyProfileId"],
  share_links: ["ownerUserId"],
};

/** Une colonne qui porte un identifiant de compte (les `*UserId`, et la liste ci-dessus). */
export function isUserIdColumn(table, column) {
  if (!column) return false;
  if (/^jellyfin_?user_?id$/i.test(column)) return true;
  return (BY_TABLE[table] ?? []).includes(column);
}
