import type { FragmentLoaderContext, HlsConfig, Loader, LoaderCallbacks, LoaderConfiguration, LoaderStats } from "hls.js";

type FragmentLoader = Loader<FragmentLoaderContext>;
export type FragmentLoaderClass = new (config: HlsConfig) => FragmentLoader;

/**
 * Le chargeur de fragments du lecteur web : l'INIT d'abord, le segment ensuite.
 *
 * hls.js demande l'init d'un flux fMP4 et son premier segment ENSEMBLE. Face à
 * Jellyfin 10.11, quand la lecture part loin du début (reprise, relais du
 * lecteur de bureau), les deux requêtes se tuent l'une l'autre : celle de
 * l'init lance l'encodage depuis 0, celle du segment le relance à la bonne
 * position. Mesuré le 11/11/2026 (HLS fMP4, AV1 + Opus, reprise à ~60 s), dans
 * un essai sur trois : l'init répond 500 (« A task was canceled »), puis à la
 * relance 200 avec un corps VIDE — hls.js le garde, plus aucun segment ne se
 * lit, et la session d'encodage reste cassée (tout revient vide).
 *
 * Deux gestes, rien d'autre de changé au chargement :
 *   - un segment de média attend que l'init en vol ait répondu (réussi ou
 *     non) : Jellyfin écrit son init, PUIS repart à la position demandée ;
 *   - un init au corps vide est un ÉCHEC de chargement (hls.js le redemande,
 *     selon sa politique), jamais un init valide.
 *
 * Un flux en TS n'a pas d'init : il ne voit aucune différence. Une fabrique
 * par lecteur (`configHls`) : l'attente ne traverse pas deux lectures.
 */
export function initFirstFragmentLoader(Base: FragmentLoaderClass): FragmentLoaderClass {
  let pendingInit: Promise<void> | null = null;

  return class InitFirstFragmentLoader implements FragmentLoader {
    private readonly inner: FragmentLoader;
    private cancelled = false;
    /** Un segment retenu derrière l'init : de quoi répondre à un abandon avant son départ. */
    private held: { context: FragmentLoaderContext; callbacks: LoaderCallbacks<FragmentLoaderContext> } | null = null;

    constructor(config: HlsConfig) {
      this.inner = new Base(config);
    }

    get context(): FragmentLoaderContext | null {
      return this.inner.context;
    }
    set context(value: FragmentLoaderContext | null) {
      this.inner.context = value;
    }
    get stats(): LoaderStats {
      return this.inner.stats;
    }
    set stats(value: LoaderStats) {
      this.inner.stats = value;
    }
    getCacheAge = (): number | null => this.inner.getCacheAge?.() ?? null;
    getResponseHeader = (name: string): string | null => this.inner.getResponseHeader?.(name) ?? null;

    destroy(): void {
      this.cancelled = true;
      this.held = null;
      this.inner.destroy();
    }

    abort(): void {
      this.cancelled = true;
      const held = this.held;
      this.held = null;
      this.inner.abort();
      // Abandonné AVANT d'être parti : le chargeur de hls.js n'a rien à dire, c'est à nous de répondre.
      if (held) {
        this.inner.stats.aborted = true;
        held.callbacks.onAbort?.(this.inner.stats, held.context, null);
      }
    }

    load(context: FragmentLoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<FragmentLoaderContext>): void {
      if (context.frag.sn === "initSegment") {
        this.loadInit(context, config, callbacks);
        return;
      }
      const pending = pendingInit;
      if (pending === null) {
        this.inner.load(context, config, callbacks);
        return;
      }
      this.held = { context, callbacks };
      void pending.then(() => {
        if (this.cancelled) return;
        this.held = null;
        this.inner.load(context, config, callbacks);
      });
    }

    private loadInit(context: FragmentLoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<FragmentLoaderContext>): void {
      let settle: () => void = () => undefined;
      const mine = new Promise<void>((resolve) => {
        settle = resolve;
      });
      pendingInit = mine;
      const done = () => {
        if (pendingInit === mine) pendingInit = null;
        settle();
      };
      this.inner.load(context, config, {
        ...callbacks,
        onSuccess: (response, stats, loaded, networkDetails) => {
          done();
          if (isEmpty(response.data)) callbacks.onError({ code: 200, text: "empty init segment" }, loaded, networkDetails, stats);
          else callbacks.onSuccess(response, stats, loaded, networkDetails);
        },
        onError: (error, loaded, networkDetails, stats) => {
          done();
          callbacks.onError(error, loaded, networkDetails, stats);
        },
        onTimeout: (stats, loaded, networkDetails) => {
          done();
          callbacks.onTimeout(stats, loaded, networkDetails);
        },
        onAbort: (stats, loaded, networkDetails) => {
          done();
          callbacks.onAbort?.(stats, loaded, networkDetails);
        },
      });
    }
  };
}

function isEmpty(data: unknown): boolean {
  if (typeof data === "string") return data.length === 0;
  return data instanceof ArrayBuffer ? data.byteLength === 0 : data === null || data === undefined;
}
