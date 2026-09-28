import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, Play } from "lucide-react";
import { WtApiError, dismissAffinityMatch } from "@tentacle-tv/api-client";
import type { WtAffinityMatchDto, WtAffinityStateDto } from "@tentacle-tv/shared";
import { useWatchTogether } from "../WatchTogetherProvider";
import { WtAvatar } from "../WatchTogetherRows";
import { AffinityPoster } from "./AffinityPoster";
import { applyAffinityPush, showAffinityNotice } from "./affinityStore";
import { formatNames, memberName } from "./affinityText";
import { useAffinityLaunch } from "./useAffinityLaunch";

/**
 * « C'est un match ! » — la proposition, faite à TOUS les participants en
 * même temps, et deux réponses seulement : « Regarder ensemble » (la lecture
 * part pour le groupe) ou « Continuer à swiper » (le match est écarté, la
 * pile reprend chez tous). La première réponse vaut pour tous, et le dit.
 *
 * L'affiche entre une fois, avec un rebond (transform et opacity seuls, rien
 * d'infini) ; sous mouvement réduit, un fondu. Le premier bouton — donc celui
 * qui reçoit le focus — est « Regarder ensemble ».
 */

const PRIMARY =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-5 text-[15px] font-bold text-cta-primary-fg outline-none transition-[background-color,transform] duration-150 hover:bg-cta-primary-bg-hover active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-60";
const SECONDARY =
  "inline-flex h-11 w-full items-center justify-center rounded-full border border-line-subtle bg-fill-soft px-5 text-sm font-semibold text-content-primary outline-none transition-colors hover:bg-fill-medium focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-60";

type Answer = "watch" | "continue";

export function AffinityMatchView({
  state, match, titleId,
}: {
  state: WtAffinityStateDto;
  match: WtAffinityMatchDto;
  titleId: string;
}) {
  const { t, i18n } = useTranslation("watchTogether");
  const { room, selfId } = useWatchTogether();
  const launch = useAffinityLaunch();
  const reduced = useReducedMotion() ?? false;
  const [answering, setAnswering] = useState<Answer | null>(null);

  const nameOf = (id: string) => (id === selfId ? t("affinityYou") : memberName(room, id) || "…");
  const others = match.likedBy.filter((id) => id !== selfId).map(nameOf);
  const subtitle = selfId && match.likedBy.includes(selfId)
    ? t("affinityMatchWithYou", { names: formatNames(others, i18n.language), title: match.title })
    : t("affinityMatchOthers", { names: formatNames(match.likedBy.map(nameOf), i18n.language), title: match.title });
  const meta = [match.year, match.mediaType === "tv" ? t("affinitySeries") : t("affinityMovie")].filter(Boolean).join(" · ");

  /** Une réponse que le serveur n'a pas prise. « answered » : un autre a
   *  répondu avant — l'état qui arrive dit la suite, rien à montrer. */
  const failed = (err: unknown) => {
    setAnswering(null);
    if (!(err instanceof WtApiError && err.code === "answered")) showAffinityNotice(null, t("errorGeneric"));
  };
  const watch = async () => {
    setAnswering("watch");
    try {
      await launch(match);
    } catch (err) {
      failed(err);
    }
  };
  const keepSwiping = async () => {
    setAnswering("continue");
    try {
      applyAffinityPush(await dismissAffinityMatch(match.key));
    } catch (err) {
      failed(err);
    }
  };

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

      <div className="relative mx-auto mt-6 flex w-full max-w-xs flex-col gap-2">
        {/* La vue arrive par-dessus la pile, modale déjà ouverte : le focus
            de la modale ne se rejoue pas, il vient d'ici. */}
        <button type="button" onClick={() => void watch()} disabled={answering !== null} className={PRIMARY} autoFocus>
          <Play aria-hidden className="h-4 w-4" fill="currentColor" />
          {answering === "watch" ? t("affinityLaunching") : t("affinityWatchTogether")}
        </button>
        <button type="button" onClick={() => void keepSwiping()} disabled={answering !== null} className={SECONDARY}>
          {t("affinityKeepSwiping")}
        </button>
      </div>
      <p className="relative mx-auto mt-3 max-w-xs text-xs leading-relaxed text-content-tertiary">
        {t("affinityFirstAnswer", { count: Math.max(1, state.participants.length - 1) })}
      </p>
    </div>
  );
}
