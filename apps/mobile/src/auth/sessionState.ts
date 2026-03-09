/**
 * In-memory session flag — resets on app restart (JS reload).
 * Used to prevent auth guard redirect loop when a 401 is received
 * without clearing the persisted token (so it survives restarts).
 */
let expired = false;

export function isSessionExpired() { return expired; }
export function setSessionExpired(v: boolean) { expired = v; }
