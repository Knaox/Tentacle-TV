import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Heart, Play, Star, X } from "lucide-react";
import type { WtAffinityMatchDto, WtAffinityStateDto } from "@tentacle-tv/shared";
import { useToast } from "../../contexts/ToastContext";
import { useWatchTogether } from "../WatchTogetherProvider";
import { WtAvatar } from "../WatchTogetherRows";
import { AffinityPoster } from "./AffinityPoster";
import { closeAffinity, showAffinityView } from "./affinityStore";
import { formatNames, memberName } from "./affinityText";
import { useAffinityLaunch } from "./useAffinityLaunch";

/**
 * Les matchs de la salle, du plus récent au plus ancien — de quoi choisir
 * quand plusieurs titres ont plu à tout le monde. Chacun se lance d'ici.
 */
export function AffinityMatchesView({ state, titleId }: { state: WtAffinityStateDto; titleId: string }) {
  const { t } = useTranslation("watchTogether");
  const { selfId } = useWatchTogether();
  const participant = state.participants.some((p) => p.userId === selfId);

  return (
    <>
      <header className="flex items-center gap-2 px-5 pb-3 pt-5">
        {participant && (
          <button
            type="button"
            onClick={() => showAffinityView("deck")}
            aria-label={t("back")}
            className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-content-secondary outline-none transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <ArrowLeft aria-hidden className="h-5 w-5" />
          </button>
        )}
        <h2 id={titleId} className="min-w-0 flex-1 text-lg font-semibold tracking-tight text-content-primary">
          {t("affinityMatchesTitle")}
          <span className="ml-2 text-sm font-medium tabular-nums text-content-tertiary">{state.matches.length}</span>
        </h2>
        <button
          type="button"
          onClick={closeAffinity}
          aria-label={t("close")}
          className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-content-tertiary outline-none transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {state.matches.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-subtle px-6 py-10 text-center">
            <Heart aria-hidden className="h-7 w-7 text-content-quaternary" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-content-secondary">{t("affinityNoMatches")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {state.matches.map((match) => <MatchRow key={match.key} match={match} />)}
          </ul>
        )}
      </div>
    </>
  );
}

function MatchRow({ match }: { match: WtAffinityMatchDto }) {
  const { t, i18n } = useTranslation("watchTogether");
  const { room, selfId } = useWatchTogether();
  const { show } = useToast();
  const launch = useAffinityLaunch();
  const [pending, setPending] = useState(false);
  const nameOf = (id: string) => (id === selfId ? t("affinityYou") : memberName(room, id) || "…");
  const meta = [match.year, match.mediaType === "tv" ? t("affinitySeries") : t("affinityMovie")].filter(Boolean).join(" · ");

  const watch = async () => {
    setPending(true);
    try {
      await launch(match);
    } catch {
      show("error", t("errorGeneric"));
      setPending(false);
    }
  };

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line-subtle bg-fill-faint p-2.5">
      <AffinityPoster itemId={match.itemId} width={120} className="h-[66px] w-11 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-content-primary" title={match.title}>{match.title}</p>
        {meta && <p className="text-xs text-content-tertiary">{meta}</p>}
        <div className="mt-1 flex items-center gap-2">
          <span className="flex -space-x-1.5" aria-hidden>
            {match.likedBy.map((id) => {
              const member = room?.members.find((m) => m.userId === id);
              return <WtAvatar key={id} userId={id} name={member?.username ?? "?"} hasAvatar={member?.hasAvatar ?? false} size={18} />;
            })}
          </span>
          <span className="sr-only">{formatNames(match.likedBy.map(nameOf), i18n.language)}</span>
          {match.superlikedBy.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-content-secondary">
              <Star aria-hidden className="h-3 w-3 fill-current text-amber-300" />
              {t("affinitySuperlikeBy", { names: formatNames(match.superlikedBy.map(nameOf), i18n.language) })}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void watch()}
        disabled={pending}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[rgba(var(--brand-rgb),0.18)] px-4 text-[13px] font-semibold text-content-primary outline-none transition-colors hover:bg-[rgba(var(--brand-rgb),0.3)] focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-60"
      >
        <Play aria-hidden className="h-3.5 w-3.5" fill="currentColor" />
        {pending ? t("affinityLaunching") : t("affinityWatch")}
      </button>
    </li>
  );
}
