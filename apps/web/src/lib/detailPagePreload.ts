import { Favorites, Home, Library, MediaDetail, Search, SettingsLayout, Watchlist } from "../lazyPages";

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
 *
 * Puis, une par temps mort, les pages qu'un onglet de la barre ouvre (lot « rf2 ») : tant que le
 * module d'une page charge, React retient la navigation entière — rien ne bouge au clic, pas
 * même l'onglet courant. Quelques dizaines de kilo-octets en tout, en cache ensuite.
 */
export function scheduleDetailPagePreload(): void {
  const idle = window as unknown as IdleWindow;
  const whenIdle = (run: () => void): void => {
    if (typeof idle.requestIdleCallback === "function") idle.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    else setTimeout(run, FALLBACK_DELAY_MS);
  };
  // La fiche d'abord (la page qu'on ouvre le plus), puis les pages de la barre, l'une après l'autre.
  const queue = [MediaDetail, Home, Library, Watchlist, Favorites, Search, SettingsLayout]
    .map((page) => (page as { preload?: () => Promise<void> }).preload)
    .filter((preload): preload is () => Promise<void> => typeof preload === "function");
  const next = (): void => {
    const preload = queue.shift();
    if (!preload) return;
    whenIdle(() => void preload().catch(() => undefined).then(next));
  };
  next();
}
