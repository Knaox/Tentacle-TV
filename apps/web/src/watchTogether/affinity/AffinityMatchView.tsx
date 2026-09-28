import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, Play, Star, X } from "lucide-react";
import type { WtAffinityStateDto } from "@tentacle-tv/shared";
import { useToast } from "../../contexts/ToastContext";
import { useWatchTogether } from "../WatchTogetherProvider";
import { WtAvatar } from "../WatchTogetherRows";
import { AffinityPoster } from "./AffinityPoster";
import { closeAffinity, leaveAffinityMatch, showAffinityView, type AffinityView } from "./affinityStore";
import { formatNames, memberName, superlikeLabel } from "./affinityText";
import { useAffinityLaunch } from "./useAffinityLaunch";

/**
 * « C'est un match ! » — la proposition de regarder ensemble. L'affiche entre
 * une fois, avec un rebond (transform et opacity seuls, rien d'infini) ; sous
 * mouvement réduit, un fondu. Le premier bouton du panneau — donc celui qui
 * reçoit le focus — est « Regarder ensemble » ; la croix vient après.
 */

const PRIMARY =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-5 text-[15px] font-bold text-cta-primary-fg outline-none transition-[background-color,transform] duration-150 hover:bg-cta-primary-bg-hover active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-60";
const SECONDARY =
  "inline-flex h-11 w-full items-center justify-center rounded-full border border-line-subtle bg-fill-soft px-5 text-sm font-semibold text-content-primary outline-none transition-colors hover:bg-fill-medium focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-60";

export function AffinityMatchView({
  state, matchKey, returnTo, titleId,
}: {
  state: WtAffinityStateDto;
  matchKey: string;
  returnTo: AffinityView | null;
  titleId: string;
}) {
  const { t, i18n } = useTranslation("watchTogether");
  const { room, selfId } = useWatchTogether();
  const { show } = useToast();
  const launch = useAffinityLaunch();
  const reduced = useReducedMotion() ?? false;
  const [pending, setPending] = useState(false);
  const match = state.matches.find((m) => m.key === matchKey);
  if (!match) return null;

  const nameOf = (id: string) => (id === selfId ? t("affinityYou") : memberName(room, id) || "…");
  const iLiked = !!selfId && match.likedBy.includes(selfId);
  const subtitle = iLiked
    ? t("affinityMatchWithYou", {
      names: formatNames(match.likedBy.filter((id) => id !== selfId).map(nameOf), i18n.language),
      title: match.title,
    })
    : t("affinityMatchOthers", { names: formatNames(match.likedBy.map(nameOf), i18n.language), title: match.title });
  const lovers = match.superlikedBy.length > 0
    ? superlikeLabel({ ids: match.superlikedBy, selfId, nameOf: (id) => memberName(room, id) || "…", t, language: i18n.language })
    : null;
  const meta = [match.year, match.mediaType === "tv" ? t("affinitySeries") : t("affinityMovie")].filter(Boolean).join(" · ");
  const participant = state.participants.some((p) => p.userId === selfId);

  const watch = async () => {
    setPending(true);
    try {
      await launch(match);
    } catch {
      show("error", t("errorGeneric"));
      setPending(false);
    }
  };
  // Un participant revient à sa pile, même si le match l'a trouvé ailleurs.
  const next = () => (participant && !returnTo ? showAffinityView("deck") : leaveAffinityMatch());

  return (
    <div className="relative overflow-y-auto px-6 pb-6 pt-9 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{ background: "radial-gradient(60% 75% at 50% 0%, rgba(var(--brand-rgb),0.32), transparent 72%)" }}
      />
      <motion.div
        className="relative mx-auto w-36"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: reduced ? 0 : -3 }}
        transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 260, damping: 18 }}
      >
        <AffinityPoster
          itemId={match.itemId}
          className="aspect-[2/3] w-36 rounded-2xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
        />
        <motion.span
          aria-hidden
          className="absolute -bottom-3 -right-3 grid h-11 w-11 place-items-center rounded-full text-white shadow-lg ring-4 ring-[var(--surface-modal)]"
          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
          initial={reduced ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: reduced ? 0 : 0.18, type: "spring", stiffness: 420, damping: 16 }}
        >
          <Heart className="h-5 w-5" fill="currentColor" />
        </motion.span>
      </motion.div>

      <h2
        id={titleId}
        className="relative mt-8 bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] bg-clip-text text-3xl font-extrabold tracking-tight text-transparent"
      >
        {t("affinityMatchTitle")}
      </h2>
      <p className="relative mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-content-primary">{subtitle}</p>
      {meta && <p className="mt-1 text-xs text-content-tertiary">{meta}</p>}

      <ul className="mt-4 flex justify-center -space-x-2" aria-hidden>
        {match.likedBy.map((id) => {
          const member = room?.members.find((m) => m.userId === id);
          return (
            <li key={id}>
              <WtAvatar userId={id} name={member?.username ?? "?"} hasAvatar={member?.hasAvatar ?? false} size={34} />
            </li>
          );
        })}
      </ul>
      {lovers && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[rgba(var(--brand-rgb),0.14)] px-3 py-1 text-xs font-semibold text-content-primary">
          <Star aria-hidden className="h-3.5 w-3.5 fill-current text-amber-300" />
          {lovers}
        </p>
      )}

      <div className="relative mx-auto mt-6 flex w-full max-w-xs flex-col gap-2">
        {/* La vue arrive souvent par-dessus la pile, modale déjà ouverte :
            le focus de la modale ne se rejoue pas, il vient d'ici. */}
        <button type="button" onClick={() => void watch()} disabled={pending} className={PRIMARY} autoFocus>
          <Play aria-hidden className="h-4 w-4" fill="currentColor" />
          {pending ? t("affinityLaunching") : t("affinityWatchTogether")}
        </button>
        <button type="button" onClick={next} disabled={pending} className={SECONDARY}>
          {participant ? t("affinityKeepSwiping") : t("affinityLater")}
        </button>
        {state.matches.length > 1 && (
          <button
            type="button"
            onClick={() => showAffinityView("matches")}
            className="mx-auto mt-1 rounded px-2 py-1 text-[13px] font-semibold text-[var(--brand-light)] underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {t("affinitySeeMatches", { count: state.matches.length })}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={closeAffinity}
        aria-label={t("close")}
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-content-tertiary outline-none transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <X aria-hidden className="h-5 w-5" />
      </button>
    </div>
  );
}
