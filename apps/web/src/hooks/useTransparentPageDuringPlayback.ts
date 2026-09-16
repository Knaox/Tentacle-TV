import { useEffect } from "react";

/**
 * Fond de page transparent PENDANT LA LECTURE — et seulement une fois la
 * surface native prête (`ready` est posé au retour de mpv_init, qui vient
 * justement de rendre la webview transparente).
 *
 * L'ordre compte : hors lecture, la webview macOS est OPAQUE (cf.
 * macos/window_opacity.rs — une fenêtre transparente coûtait une recomposition
 * alpha permanente). Rendre la page transparente avant la bascule native
 * laisserait voir, le temps d'une image ou deux, le fond de base blanc de
 * WebKit. À la sortie c'est l'inverse : le nettoyage React rend la page opaque
 * de façon synchrone, la webview repasse en opaque juste après (mpv_destroy) —
 * jamais de fenêtre de temps où les deux sont transparents.
 *
 * Extrait de `DesktopPlayer` (limite de 300 lignes par fichier).
 */
export function useTransparentPageDuringPlayback(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const prev = document.body.style.background;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => { document.body.style.background = prev; document.documentElement.style.background = ""; };
  }, [ready]);
}
