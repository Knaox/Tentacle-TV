/**
 * Le champ optionnel `tab` d'un manifeste de plugin (`plugin.json`) : comment
 * l'app mobile nomme et illustre l'onglet unique qui regroupe les pages de
 * l'extension. Contrat :
 *
 *   "tab": { "icon": "send", "labels": { "fr": "Demandes", "en": "Requests" } }
 *
 * `icon` est un nom d'icône Feather ; `labels` est indexé par code de langue
 * (deux lettres), l'anglais servant de repli. Rien d'autre n'est relayé — le
 * manifeste n'est validé nulle part ailleurs, ce lecteur est la seule garde.
 * Sans champ (ou champ mal formé), le client retombe sur sa table des plugins
 * connus, puis sur le nom du plugin.
 */
export interface PluginTabMeta {
  icon?: string;
  labels?: Record<string, string>;
}

export function readTabMeta(manifest: unknown): PluginTabMeta | undefined {
  if (!manifest || typeof manifest !== "object") return undefined;
  const tab = (manifest as { tab?: unknown }).tab;
  if (!tab || typeof tab !== "object" || Array.isArray(tab)) return undefined;
  const { icon, labels } = tab as { icon?: unknown; labels?: unknown };
  const out: PluginTabMeta = {};
  if (typeof icon === "string" && icon.trim()) out.icon = icon.trim();
  if (labels && typeof labels === "object" && !Array.isArray(labels)) {
    const clean = Object.fromEntries(
      Object.entries(labels as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "",
      ),
    );
    if (Object.keys(clean).length > 0) out.labels = clean;
  }
  return out.icon || out.labels ? out : undefined;
}
