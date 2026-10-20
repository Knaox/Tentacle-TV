/**
 * Les invitations que la boîte a déjà présentées d'elle-même
 * (`shouldAutoOpenInbox`), gardées sur l'APPAREIL : refermée sans réponse, une
 * invitation ne revient ni au rechargement de la page, ni dans un nouvel
 * onglet, ni au démarrage suivant de l'app (constat du 21/10 : elle revenait à
 * chaque rechargement). Elle reste dans le panneau et le compteur. Les
 * identifiants sont ceux du serveur, éphémères : seuls les derniers sont gardés.
 *
 * ⚠️ Clé traversée par une chaîne (le stockage des appareils) : jamais
 * renommée. Le mobile la précharge (`RNStorageAdapter`).
 */

export const WT_INVITES_SHOWN_KEY = "tentacle_wt_invites_shown";

/** Les derniers identifiants gardés : une invitation vit quelques minutes. */
export const WT_INVITES_SHOWN_MAX = 50;

interface ReadableStore {
  getItem(key: string): string | null;
}

interface WritableStore extends ReadableStore {
  setItem(key: string, value: string): void;
}

/** Les invitations déjà présentées sur cet appareil (vide si rien, ou illisible). */
export function readShownInvites(store: ReadableStore): Set<string> {
  try {
    const parsed: unknown = JSON.parse(store.getItem(WT_INVITES_SHOWN_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/** Ajoute ces invitations à celles présentées (`shown`, modifié) et les garde sur l'appareil. */
export function rememberShownInvites(store: WritableStore, shown: Set<string>, ids: readonly string[]): void {
  const before = shown.size;
  for (const id of ids) shown.add(id);
  if (shown.size === before) return;
  // Un Set garde l'ordre d'insertion : les plus récentes sont au bout.
  const kept = [...shown].slice(-WT_INVITES_SHOWN_MAX);
  try {
    store.setItem(WT_INVITES_SHOWN_KEY, JSON.stringify(kept));
  } catch {
    // Stockage plein ou bloqué (navigation privée) : la mémoire de la page suffit.
  }
}
