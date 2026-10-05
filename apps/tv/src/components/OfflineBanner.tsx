import { OfflineRedesign } from "../redesignWiring/overlays/OfflineRedesign";

interface OfflineBannerProps {
  visible: boolean;
  /** Relance le test du serveur ; la promesse dit quand il a répondu. */
  onRetry: () => void | Promise<unknown>;
}

/** Le voile hors ligne (la refonte, `redesignWiring/overlays/OfflineRedesign`). */
export function OfflineBanner(props: OfflineBannerProps) {
  return <OfflineRedesign {...props} />;
}
