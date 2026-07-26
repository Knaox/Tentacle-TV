/**
 * Ouvre une URL externe dans le navigateur système.
 *
 * Dans une webview de bureau, un simple `<a target="_blank">` n'ouvre pas le
 * navigateur (surtout WKWebView/macOS) → on passe par le pont natif. Sur le
 * web, on garde `window.open`.
 */
import { isDesktopApp, openUrl } from "../desktop/bridge";

export async function openExternal(url: string): Promise<void> {
  if (typeof window === "undefined" || !url) return;
  if (isDesktopApp()) {
    try {
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
