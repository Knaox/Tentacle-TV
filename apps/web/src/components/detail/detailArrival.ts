import { useEffect, useMemo, useState } from "react";

/**
 * L'ARRIVÉE de la fiche : rien ne se montre avant que ses images — décor,
 * affiche, logo — soient décodées. Sans cette porte, le calque d'ouverture
 * s'effaçait dès l'affiche posée, et le logo (ou l'affiche en haute
 * définition, plus lourde que la vignette qui avait volé) surgissait une
 * seconde plus tard sur une page déjà là (mesuré : logo à +1,4 s, sans fondu).
 * Sans calque, le fondu du décor et de l'affiche se jouait à vide, et l'image
 * apparaissait d'un coup en arrivant.
 *
 * Plafond : `ARRIVAL_HOLD_MS` après l'arrivée de la fiche, on montre quand
 * même — un réseau lent ne retient jamais la page. Ce qui arrive après fond
 * de lui-même (`useLateReveal`), jamais d'un coup.
 */
export const ARRIVAL_HOLD_MS = 800;

export type ArtState = "ready" | "pending" | "settled";

/** Une image déjà en mémoire (cache du navigateur) : prête sans attendre un rendu. */
export function isImageCached(url: string): boolean {
  if (typeof Image === "undefined") return false;
  const probe = new Image();
  probe.src = url;
  return probe.complete && probe.naturalWidth > 0;
}

/**
 * Charge et décode une image hors de l'écran. `decode()` manque au moteur des
 * téléviseurs LG (Chrome 53, qui compile aussi cette fiche) : le chargement
 * seul y fait foi.
 */
function decodeImage(url: string): Promise<void> {
  const image = new Image();
  image.decoding = "async";
  if (typeof image.decode === "function") {
    image.src = url;
    return image.decode();
  }
  return new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(url));
    image.src = url;
  });
}

/** Pur : la fiche peut-elle se montrer ? Chaque image prête ou en échec — ou le plafond atteint. */
export function arrivalReady(states: readonly ArtState[], timedOut: boolean): boolean {
  return timedOut || states.every((state) => state !== "pending");
}

/**
 * La porte d'arrivée : `true` une fois les images de la fiche décodées (ou en
 * échec), ou `ARRIVAL_HOLD_MS` après que `key` (l'item) est connu. Elle reste
 * ouverte pour cette clé. `key` absent : rien à attendre encore, fermée.
 */
export function useDetailArrival(key: string | null, urls: ReadonlyArray<string | null>): boolean {
  // Une liste neuve à chaque rendu : la clé est son texte, pas son identité.
  const joined = urls.filter(Boolean).join("\n");
  const wanted = useMemo(() => (joined ? joined.split("\n") : []), [joined]);
  // Ce qui est déjà en mémoire au premier rendu ne fait pas attendre, pas même une image.
  const [done, setDone] = useState<{ key: string | null; urls: Set<string> }>(() => ({
    key, urls: new Set(wanted.filter(isImageCached)),
  }));
  const [timedOutFor, setTimedOutFor] = useState<string | null>(null);
  if (done.key !== key) setDone({ key, urls: new Set(wanted.filter(isImageCached)) });

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const settle = (url: string) => {
      if (alive) setDone((prev) => (prev.key !== key || prev.urls.has(url) ? prev : { key, urls: new Set(prev.urls).add(url) }));
    };
    // Un échec compte comme réglé : l'image de repli prendra sa place.
    for (const url of wanted) decodeImage(url).then(() => settle(url), () => settle(url));
    const timer = setTimeout(() => { if (alive) setTimedOutFor(key); }, ARRIVAL_HOLD_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [key, wanted]);

  if (!key) return false;
  const states = wanted.map((url): ArtState => (done.key === key && done.urls.has(url) ? "settled" : "pending"));
  return arrivalReady(states, timedOutFor === key);
}

/**
 * Le filet : une image qui n'était pas encore là quand la fiche s'est montrée
 * FOND en arrivant (opacité seule, 300 ms) au lieu de surgir. Une image déjà
 * en mémoire au montage s'affiche telle quelle — elle fait partie de l'entrée.
 * À poser sur un CONTENEUR de l'image (son opacité peut être animée par
 * ailleurs), `onLoad` / `onError` sur l'image.
 */
export function useLateReveal(url: string | null) {
  const [state, setState] = useState(() => ({ url, shown: !url || isImageCached(url), late: false }));
  if (state.url !== url) setState({ url, shown: !url || isImageCached(url), late: false });
  const reveal = () => setState((prev) => (prev.url === url && !prev.shown ? { ...prev, shown: true, late: true } : prev));
  return {
    style: { opacity: state.shown ? 1 : 0, transition: state.late ? "opacity 300ms ease-out" : undefined },
    onLoad: reveal,
    onError: reveal,
  };
}
