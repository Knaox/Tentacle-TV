/**
 * Les bandes-annonces qu'une extension demande à l'hôte de jouer
 * (`__tentacle_bridge.openTrailer`, l'API d'avant le catalogue) : la liste
 * reçue par `postMessage`, non typée, validée ici. Sorti de `PluginIframe.tsx`
 * (300 lignes au plus par fichier).
 */

export interface PluginTrailer {
  Url: string;
  Name?: string;
}

/** Valide la liste de trailers reçue du plugin (postMessage non typé). */
export function sanitizeTrailers(input: unknown): PluginTrailer[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t): t is { Url: string; Name?: unknown } =>
      !!t && typeof (t as { Url?: unknown }).Url === "string"
      && /^https?:\/\//i.test((t as { Url: string }).Url))
    .map((t) => ({ Url: t.Url, Name: typeof t.Name === "string" ? t.Name : undefined }))
    .slice(0, 50);
}
