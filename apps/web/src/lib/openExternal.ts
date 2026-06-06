/**
 * Ouvre une URL externe dans le navigateur système.
 *
 * Dans le webview Tauri (desktop), un simple `<a target="_blank">` n'ouvre pas
 * le navigateur (surtout WKWebView/macOS) → on passe par le plugin `opener`.
 * Sur le web, on garde `window.open`.
 */
export async function openExternal(url: string): Promise<void> {
  if (typeof window === "undefined" || !url) return;
  if ("__TAURI_INTERNALS__" in window) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      /* repli ci-dessous */
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Handler de clic prêt à l'emploi pour un lien externe (preventDefault + openExternal). */
export function externalLinkHandler(url: string) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    void openExternal(url);
  };
}
