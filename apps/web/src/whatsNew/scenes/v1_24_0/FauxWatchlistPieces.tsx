import { useTranslation } from "react-i18next";
import { BookmarkMinus, Play, Undo2, X } from "lucide-react";
import type { ScenePoster } from "../../sceneMedia";
import { CARD_TONES } from "../FauxCard";

/** Une vignette de la file « Reprendre » (`WatchlistResumeShelf`) : le décor du titre, sa reprise. */
export function FauxResumeTile({ poster, tone }: { poster: ScenePoster | null; tone: number }) {
  const image = poster?.backdropUrl ?? poster?.url ?? null;
  return (
    <span className="relative block aspect-video w-full overflow-hidden rounded-lg bg-fill-subtle ring-1 ring-line-subtle">
      {image ? <img src={image} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0" style={{ background: CARD_TONES[tone % CARD_TONES.length] }} />}
      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-black"><Play size={9} fill="currentColor" className="ml-px" /></span>
      <span className="absolute inset-x-2 bottom-1.5 truncate text-[9px] font-semibold text-white">{poster?.title ?? " "}</span>
      {poster?.progress != null && (
        <span className="absolute inset-x-0 bottom-0 block h-[2px] bg-black/55">
          <span className="block h-full" style={{ width: `${poster.progress}%`, background: "var(--progress-fill)" }} />
        </span>
      )}
    </span>
  );
}

/**
 * Une ligne de la vue liste (`WatchlistRow`) : affiche, titre, où l'on en est
 * — en barre ET en mots —, puis Lire et Retirer, toujours visibles.
 */
export function FauxWatchlistRow({ poster, tone }: { poster: ScenePoster | null; tone: number }) {
  const { t } = useTranslation("watchlist");
  const percent = poster?.progress != null && poster.progress > 0 ? Math.round(poster.progress) : null;
  return (
    <div className="flex h-[46px] items-center gap-2.5 rounded-xl border border-line-subtle bg-surface-1 px-2">
      <span className="relative aspect-[2/3] h-9 shrink-0 overflow-hidden rounded bg-fill-subtle">
        {poster ? <img src={poster.url} alt="" draggable={false} className="h-full w-full object-cover" /> : <span className="absolute inset-0" style={{ background: CARD_TONES[tone % CARD_TONES.length] }} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold text-content-primary">{poster?.title ?? " "}</span>
        <span className="mt-1 flex items-center gap-2">
          {percent !== null ? (
            <>
              <span className="h-[3px] w-24 overflow-hidden rounded-full bg-fill-soft">
                <span className="block h-full rounded-full" style={{ width: `${percent}%`, background: "var(--progress-fill)" }} />
              </span>
              <span className="text-[8px] font-medium tabular-nums text-content-tertiary">{t("progressPercent", { percent })}</span>
            </>
          ) : (
            <span className="text-[8px] text-content-quaternary">{t("notStarted")}</span>
          )}
        </span>
      </span>
      <span className="flex h-[26px] items-center gap-1 rounded-full border border-cta-primary-border bg-cta-primary-bg px-2.5 text-[9px] font-bold text-cta-primary-fg">
        <Play size={9} fill="currentColor" />
        {percent !== null ? t("resume") : t("play")}
      </span>
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-line-subtle bg-fill-subtle text-content-tertiary">
        <BookmarkMinus size={11} />
      </span>
    </div>
  );
}

/** « … a quitté Ma liste — Annuler » (`WatchlistUndoToast`). */
export function FauxUndoToast({ title }: { title: string }) {
  const { t } = useTranslation(["watchlist", "common"]);
  return (
    <div className="flex h-9 items-center gap-2 rounded-xl border border-line-subtle bg-surface-toolbar pl-3 pr-1 shadow-2xl">
      <span className="min-w-0 flex-1 truncate text-[10px] text-content-primary">{t("watchlist:removed", { title })}</span>
      <span className="flex h-7 w-[76px] shrink-0 items-center justify-center gap-1 text-[10px] font-bold text-brand-light">
        <Undo2 size={11} /> {t("watchlist:undo")}
      </span>
      <span className="flex h-7 w-[26px] shrink-0 items-center justify-center text-content-quaternary"><X size={11} /></span>
    </div>
  );
}
