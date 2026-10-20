/**
 * Sonde du banc Watch Together (`apps/server-e2e/wt-bench`), en DÉVELOPPEMENT
 * seulement : le banc lit l'app par Hermes (CDP de Metro), sans geste, et
 * mesure la dérive entre membres sur l'heure murale du Mac.
 *
 * `raw` est la DERNIÈRE annonce brute du moteur (position de film, heure de
 * réception) — la vérité terrain la plus proche que le JS connaisse ; `pos`
 * est ce que le port rend au moteur de synchro (extrapolé). En production,
 * rien n'est posé (`__DEV__` faux).
 */

export interface BenchProbe {
  sample(): { pos: number | null; raw: { pos: number | null; atMs: number }; paused: boolean; rate: number; ready: boolean; route: string };
  action(kind: "play" | "pause" | "seekBy", value?: number | null): void;
}

/** La dernière annonce du moteur, tenue par le port (`useMobileWtTransport`). */
export const benchRaw: { pos: number | null; atMs: number } = { pos: null, atMs: 0 };

type ProbeHost = typeof globalThis & { __wtBench?: BenchProbe };

/** Pose la sonde ; rend de quoi la retirer (lecteur démonté). */
export function installBenchProbe(probe: BenchProbe): () => void {
  if (!__DEV__) return () => undefined;
  const host = globalThis as ProbeHost;
  host.__wtBench = probe;
  return () => {
    if (host.__wtBench === probe) delete host.__wtBench;
  };
}
