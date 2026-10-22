/**
 * Un identifiant de titre Jellyfin : un GUID, avec ou sans tirets. Tout ce
 * qui n'y ressemble pas (`../System/…`, `abc?userId=…`) n'entre jamais dans
 * un chemin envoyé à Jellyfin — surtout sous la clé d'administration.
 */
const JELLYFIN_ITEM_ID = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function isJellyfinItemId(id: string): boolean {
  return JELLYFIN_ITEM_ID.test(id);
}

/** Le segment de chemin d'un titre, ou `null` si l'identifiant n'en est pas un. */
export function jellyfinItemSegment(id: string): string | null {
  return isJellyfinItemId(id) ? encodeURIComponent(id) : null;
}
