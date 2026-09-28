import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { LogOut, PartyPopper } from "lucide-react";
import {
  fetchAffinity, leaveAffinity, swipeLangOf, useAffinityDeck, useSwipeCardDetails,
} from "@tentacle-tv/api-client";
import type { SwipeVerdict } from "@tentacle-tv/api-client";
import type { WtAffinityStateDto } from "@tentacle-tv/shared";
import { SwipeControls } from "../../components/swipe/SwipeControls";
import { SwipeStack } from "../../components/swipe/SwipeStack";
import { SwipeErrorState, SwipeSaveFailedNotice, SwipeSkeleton } from "../../components/swipe/SwipeStates";
import { useSwipeKeyboard } from "../../components/swipe/useSwipeKeyboard";
import { AffinityHeader } from "./AffinityHeader";
import {
  affinityFetchMark, applyAffinityFetch, closeAffinity, showAffinityMatch, showAffinityView,
} from "./affinityStore";

/**
 * La pile de l'affinité : la mécanique d'« Affiner » réduite à trois gestes —
 * j'aime (droite, →), pas pour moi (gauche, ←), annuler (Z) —, sans coup de
 * cœur, sans « passer », sans verso (`binary`), nourrie par la pile COMMUNE
 * du groupe. Monter la vue, c'est rejoindre la séance.
 *
 * `paused` : un match ou la liste des matchs la recouvre — elle reste montée
 * (sa file, son historique d'annulation) mais n'écoute plus le clavier.
 */

/** Tout ce qui n'est pas la carte dans la modale : en-tête, participants,
 *  boutons, aide, marges du voile (cf. `CARD_WIDTH`). Mesuré à 1440×900 :
 *  à 23 rem la modale débordait de 12 px ; à 27, tout tient avec de l'air. */
const DECK_CHROME = "27rem";

/** Ni verso ni synopsis dans le swipe de groupe : rien à basculer. */
const noop = () => undefined;

export function AffinityDeckView({ state, titleId, paused }: { state: WtAffinityStateDto; titleId: string; paused: boolean }) {
  const { t, i18n } = useTranslation(["watchTogether", "swipe"]);
  const lang = swipeLangOf(i18n.language);

  // La séance tenue n'est plus celle du serveur : relire son état.
  const refetchState = useCallback(() => {
    const mark = affinityFetchMark();
    fetchAffinity().then((s) => applyAffinityFetch(s, mark)).catch(() => undefined);
  }, []);
  const deck = useAffinityDeck(state.sessionId, { onGone: refetchState, onMatch: showAffinityMatch });

  const [exitVerdict, setExitVerdict] = useState<SwipeVerdict | null>(null);
  const [announce, setAnnounce] = useState("");
  const top = deck.cards[0];
  const next = deck.cards[1];
  // Pas de verso, mais son titre localisé et sa durée habillent le recto ;
  // la suivante les porte déjà — promue en tête, son texte ne se recompose
  // pas sous les yeux.
  const { data: details } = useSwipeCardDetails(top, lang);
  const { data: nextDetails } = useSwipeCardDetails(next, lang);

  const { judge, undo, canUndo } = deck;
  const onJudge = useCallback((verdict: SwipeVerdict) => {
    if (!top || (verdict !== "like" && verdict !== "dislike")) return;
    setExitVerdict(verdict);
    setAnnounce(`${t(`swipe:${verdict}`)} — ${top.title}`);
    judge(verdict);
  }, [top, judge, t]);
  const onUndo = useCallback(() => {
    if (!canUndo) return;
    setExitVerdict(null);
    setAnnounce(t("swipe:undone"));
    undo();
  }, [canUndo, undo, t]);
  useSwipeKeyboard({ enabled: !paused && (!!top || canUndo), onJudge, onUndo, onToggleInfo: noop, binary: true });

  const stopParticipating = async () => {
    await leaveAffinity().catch(() => undefined);
    closeAffinity();
  };

  return (
    <>
      <AffinityHeader state={state} titleId={titleId} />
      <div
        className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-5 pb-4 pt-3"
        style={{ ["--swipe-chrome" as string]: DECK_CHROME }}
      >
        {deck.loading ? (
          <SwipeSkeleton />
        ) : deck.error ? (
          <SwipeErrorState onRetry={deck.retry} />
        ) : deck.empty ? (
          <AffinityDeckEmpty />
        ) : (
          <SwipeStack
            cards={deck.cards}
            exitVerdict={exitVerdict}
            infoOpen={false}
            details={details}
            nextDetails={nextDetails}
            onJudge={onJudge}
            onToggleInfo={noop}
            binary
          />
        )}
        {deck.saveFailed && <SwipeSaveFailedNotice onDismiss={deck.dismissSaveFailed} />}
        {!deck.error && (!deck.empty || canUndo) && (
          <SwipeControls
            disabled={!top}
            canUndo={canUndo}
            onJudge={onJudge}
            onUndo={onUndo}
            binary
            label={t("affinityTitle")}
          />
        )}
        <p className="max-w-sm text-center text-xs leading-relaxed text-content-tertiary">{t("affinityHint")}</p>
        <button
          type="button"
          onClick={() => void stopParticipating()}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-content-tertiary outline-none transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <LogOut aria-hidden className="h-3.5 w-3.5" />
          {t("affinityLeave")}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </>
  );
}

/** Tout est jugé : un autre type, peut-être. */
function AffinityDeckEmpty() {
  const { t } = useTranslation("watchTogether");
  return (
    <div className="flex max-w-sm flex-col items-center py-10 text-center" role="status">
      <span
        aria-hidden
        className="grid h-14 w-14 place-items-center rounded-full text-white"
        style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
      >
        <PartyPopper className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-content-primary">{t("affinityEmptyTitle")}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-content-secondary">{t("affinityEmptyBody")}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => showAffinityView("kinds")}
          className="inline-flex h-10 items-center rounded-full border border-line-subtle bg-fill-soft px-4 text-[13px] font-semibold text-content-primary outline-none transition-colors hover:bg-fill-medium focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {t("affinityOtherKind")}
        </button>
      </div>
    </div>
  );
}
