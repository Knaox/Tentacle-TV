/**
 * Accusé du démarrage à froid : la grille plein écran « dites-nous ce que vous
 * aimez » ne s'IMPOSE qu'une fois par compte et par appareil — ensuite, le
 * bandeau de la page la rouvre à volonté. Stockage par APPAREIL (localStorage,
 * comme tentacle_pinned_nav) : un tableau d'identifiants de comptes, borné —
 * un appareil partagé garde l'accusé de chacun.
 */

const KEY = "tentacle_coldstart_ack";
const KEEP_MAX = 8;

function currentUserId(): string | null {
  try {
    const raw = localStorage.getItem("tentacle_user");
    if (!raw) return null;
    const user = JSON.parse(raw) as { Id?: unknown };
    return typeof user?.Id === "string" && user.Id ? user.Id : null;
  } catch {
    return null;
  }
}

function readAcks(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function hasColdStartAck(): boolean {
  const id = currentUserId();
  return id != null && readAcks().includes(id);
}

export function markColdStartAck(): void {
  const id = currentUserId();
  if (!id) return;
  const next = [id, ...readAcks().filter((v) => v !== id)].slice(0, KEEP_MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Stockage refusé (navigation privée…) : la grille se réimposera, sans casse.
  }
}
