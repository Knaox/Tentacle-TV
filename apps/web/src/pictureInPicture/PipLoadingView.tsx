import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoadingBar } from "../components/player/PlayerLoadingScreen";

/**
 * Le chargement d'une lecture DANS le PiP — une autre lecture lancée pendant
 * le PiP, un épisode suivant : sans lui, la fenêtre ne montrait que le noir de
 * mpv entre deux fichiers (retour de Damien).
 *
 * Le même langage que l'écran de chargement du lecteur (`PlayerLoadingScreen`),
 * à l'échelle d'une vignette : l'image de ce qui arrive, un voile, le titre et
 * la barre de chargement de la marque. Opaque : rien de la vidéo d'avant ne
 * transparaît. Aucun `backdrop-filter`, aucune animation hors `transform` et
 * `opacity` (CLAUDE.md, « Coût GPU ») ; la barre se calme sous mouvement réduit.
 *
 * L'image se montre en fondu à son arrivée — sauf si elle est déjà là (le
 * cache) : entre deux phases du chargement, le PiP change de portail et la
 * vue renaît ; elle ne doit pas reclignoter.
 */

export interface PipLoading {
  posterUrl?: string;
  title?: string;
}

/** La durée du fondu de sortie, quand l'image de la vidéo arrive. */
export const PIP_LOADING_EXIT_MS = 320;

/**
 * La dernière valeur non nulle, gardée le temps du fondu de sortie : la vue
 * s'efface au lieu de disparaître d'un coup quand la vidéo démarre.
 */
export function useLingeringLoading(loading: PipLoading | null): { shown: PipLoading | null; leaving: boolean } {
  const [shown, setShown] = useState<PipLoading | null>(loading);
  useEffect(() => {
    if (loading !== null) {
      setShown(loading);
      return;
    }
    const timer = window.setTimeout(() => setShown(null), PIP_LOADING_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [loading]);
  return { shown: loading ?? shown, leaving: loading === null && shown !== null };
}

function Poster({ url }: { url: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  // Avant la première peinture : une image déjà en cache paraît sans fondu.
  useLayoutEffect(() => {
    const img = ref.current;
    setReady(img !== null && img.complete && img.naturalWidth > 0);
  }, [url]);
  return (
    <img
      ref={ref} src={url} alt="" aria-hidden="true" draggable={false}
      onLoad={() => setReady(true)}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-0"}`}
    />
  );
}

export const PipLoadingView = memo(function PipLoadingView({ loading, leaving }: {
  loading: PipLoading;
  leaving: boolean;
}) {
  const { t } = useTranslation("player");
  return (
    <div
      role="status" aria-live="polite"
      className={`pointer-events-none absolute inset-0 overflow-hidden bg-[#0a0a12] transition-opacity motion-reduce:transition-none ${leaving ? "opacity-0" : "opacity-100"}`}
      style={{ transitionDuration: `${String(PIP_LOADING_EXIT_MS)}ms` }}
    >
      {/* Le fond de repli, teinté marque, tant que l'image n'est pas là. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(var(--brand-rgb),0.24),transparent_65%)]" />
      {loading.posterUrl && <Poster url={loading.posterUrl} />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/25" />
      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/70">{t("loading")}</p>
        {loading.title && <p className="truncate text-sm font-semibold text-white">{loading.title}</p>}
        <LoadingBar className="mt-1" />
      </div>
    </div>
  );
});
