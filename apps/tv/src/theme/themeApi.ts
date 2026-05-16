import type { BackendThemeState } from "./types";

/** AbortSignal.timeout() polyfill for React Native (Hermes). */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function fetchThemeState(
  backendUrl: string,
): Promise<BackendThemeState> {
  const res = await fetch(`${backendUrl}/api/theme`, {
    signal: timeoutSignal(8000),
  });
  if (!res.ok) {
    throw new Error(`Theme fetch failed: HTTP ${res.status}`);
  }
  return (await res.json()) as BackendThemeState;
}
