import { MediaDetail } from "../lazyPages";

/** Le démarrage d'abord : la fiche se charge quand la page affichée a fini. */
const IDLE_TIMEOUT_MS = 4_000;
const FALLBACK_DELAY_MS = 2_000;

interface IdleWindow {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
}

/**
 * Charge le module de la fiche média en temps mort, une fois l'application
 * rendue. Sans lui, un clic sur une affiche attendait d'abord le chunk de la
 * page (≈ 2,5 s sur un réseau lent, relevé du lot 1017) — pas de vol, rien
 * qui bouge, puis une ouverture dont l'origine avait expiré. `preload` peut
 * manquer : le client LG substitue `lazyPages` (`lazyPagesTv.tsx`).
 */
export function scheduleDetailPagePreload(): void {
  const preload = (MediaDetail as { preload?: () => Promise<void> }).preload;
  if (typeof preload !== "function") return;
  const run = () => void preload().catch(() => undefined);
  const idle = window as unknown as IdleWindow;
  if (typeof idle.requestIdleCallback === "function") idle.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
  else setTimeout(run, FALLBACK_DELAY_MS);
}
