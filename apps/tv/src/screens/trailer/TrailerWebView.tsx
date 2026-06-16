import { WebView } from "react-native-webview";
import type { TrailerPlayerProps } from "./types";

/**
 * Variant Android : lecture de l'embed YouTube dans une WebView.
 *
 * Le pendant `TrailerWebView.ios.tsx` (résolu pour Apple TV — tvOS partage
 * la plateforme Metro `ios`) ne dépend PAS de `react-native-webview`, qui
 * n'a aucun support tvOS : il lit un flux MP4 résolu côté backend via
 * `react-native-video`. C'est ce qui permet au bundle Apple TV de ne jamais
 * référencer ce module natif.
 */
export const TRAILER_WEBVIEW_SUPPORTED = true;

export function TrailerWebView({ embedUri, onLoadEnd, onError }: TrailerPlayerProps) {
  return (
    <WebView
      source={{ uri: embedUri }}
      style={{ flex: 1, backgroundColor: "#000" }}
      // Non focusable : la WebView ne doit JAMAIS capter la télécommande.
      focusable={false}
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo
      javaScriptEnabled
      domStorageEnabled
      onLoadEnd={onLoadEnd}
      onError={onError}
    />
  );
}
