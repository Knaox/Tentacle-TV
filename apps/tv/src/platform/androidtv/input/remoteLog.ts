import type { RemoteInput } from "@tentacle-tv/tv-core";

/**
 * Le JOURNAL de la télécommande, en développement : chaque signal natif et
 * l'intention qu'il porte, dans la console — Metro et logcat (`ReactNativeJS`),
 * préfixe `[remote]`. Pour éprouver la table au boîtier ou à l'émulateur
 * (`adb shell input keyevent …`), sans banc.
 *
 * Allumé par `TENTACLE_TV_REMOTE_LOG=1` dans l'environnement de Metro
 * (inliné par Babel : `babel/inlineRedesignFlag.js` ; `pnpm tv:refonte:android
 * --journal`). Éteint, rien ne s'abonne : l'abonnement natif reste à la
 * demande des écrans. Allumé, il observe — donc tient l'abonnement ouvert.
 */
export const REMOTE_LOG_ENABLED = process.env.TENTACLE_TV_REMOTE_LOG === "1";

export function attachRemoteLog(input: RemoteInput): void {
  if (!REMOTE_LOG_ENABLED) return;
  // Les observateurs de signaux passent avant ceux d'intentions, dans le même
  // `receive` : chaque intention se lit sous son signal.
  input.observeSignals((signal) => {
    console.log(`[remote] ${signal.name} ${signal.phase ?? "—"}${signal.repeat ? " (répété)" : ""}`);
  });
  input.observe((event) => {
    console.log(`[remote]   → ${JSON.stringify(event.intent)}`);
  });
}
