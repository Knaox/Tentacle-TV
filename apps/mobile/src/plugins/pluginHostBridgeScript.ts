/**
 * Le pont que la page d'une extension trouve sous `window.__tentacle_bridge`
 * — le MÊME contrat que l'iframe web (`pluginIframe/buildPluginBridge.ts`),
 * réduit à ce qui a un sens dans une WebView :
 *
 *   - `setOverlay(open)` : la page affiche une surface modale (fiche, feuille
 *     de filtres…). Le natif efface sa barre d'onglets et voile son en-tête,
 *     comme le web voile son chrome : la barre ne flotte plus par-dessus le pied
 *     d'une feuille, et rien derrière le panneau ne reste cliquable ;
 *   - `openExternal(url)` : ouvre un lien (http/https) hors de l'application ;
 *   - `openTrailerFor(query)` : l'écran des bandes-annonces de l'app sur le
 *     CATALOGUE d'un titre TMDB (`OPEN_TRAILER_CATALOG`, mêmes champs que
 *     l'hôte web : `tmdbId`, `mediaType`, `season`, `title`, `start`) — offert
 *     quand `__tentacle_env.trailerCatalog` le dit ;
 *   - `setTrailerPreviewMuted(muted)` : accepté pour l'API commune, sans effet
 *     (le mobile ne montre pas d'aperçu au survol, `trailerPreview.enabled` est
 *     faux).
 *
 * Et, dans l'autre sens, `window.__tentacleCloseOverlay()` : le natif demande
 * à la page de fermer sa surface du DESSUS (toucher sur le voile, retour
 * Android). C'est la touche Échap que les pages écoutent déjà pour cela — rien
 * de propre à une extension en particulier.
 *
 * Un pont déjà posé n'est pas remplacé. Aucune séquence `</script>` ici : le
 * script est inliné dans le document.
 */
export function buildHostBridgeScript(): string {
  return `
    (function () {
      function post(msg) {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
      if (!window.__tentacle_bridge) {
        window.__tentacle_bridge = {
          setOverlay: function (open) { post({ type: "OVERLAY", open: open === true }); },
          openExternal: function (url) { post({ type: "OPEN_EXTERNAL", url: String(url || "") }); }
        };
      }
      var bridge = window.__tentacle_bridge;
      if (!bridge.openTrailerFor) {
        bridge.openTrailerFor = function (query) {
          var q = query || {};
          post({ type: "OPEN_TRAILER_CATALOG", tmdbId: q.tmdbId, mediaType: q.mediaType, season: q.season, title: q.title, start: q.start });
        };
      }
      if (!bridge.setTrailerPreviewMuted) {
        bridge.setTrailerPreviewMuted = function (muted) { post({ type: "TRAILER_PREVIEW_MUTED", muted: muted === true }); };
      }
      window.__tentacleCloseOverlay = function () {
        var target = document.activeElement || document.body || document;
        target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
      };
    })();
  `;
}
