import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { swipeLangOf, useSwipeCardDetails, useSwipeDeck } from "@tentacle-tv/api-client";
import type { SwipeCard, SwipeVerdict } from "@tentacle-tv/api-client";
import { useExternalTitleState, useTitleProvider } from "../cards/external/useTitleProvider";
import { SwipeControls } from "./SwipeControls";
import { SwipeHeader } from "./SwipeHeader";
import { SwipeShortcutsLegend } from "./SwipeShortcutsLegend";
import { SwipeStack } from "./SwipeStack";
import {
  SwipeEmptyState,
  SwipeErrorState,
  SwipeLibraryOnlyNotice,
  SwipeSaveFailedNotice,
  SwipeSkeleton,
} from "./SwipeStates";
import { useSwipeKeyboard } from "./useSwipeKeyboard";

/** L'identité d'une carte HORS bibliothèque — la seule qui ait une fiche chez l'extension. */
function outsideTitle(card: SwipeCard | undefined) {
  return card && !card.jellyfinItemId ? { mediaType: card.mediaType, tmdbId: card.tmdbId } : null;
}

/**
 * La section « Affiner » de la page Recommandations : une pile de films et de
 * séries — de la bibliothèque et d'ailleurs — à juger d'un geste (glisser,
 * bouton ou clavier). Chaque verdict nourrit le moteur de recommandations ;
 * l'annulation rend la carte. Montée seulement quand la section est choisie :
 * le clavier (← → ↑ ↓ Z) ne s'écoute que là.
 */
export function SwipeSection() {
  const { t, i18n } = useTranslation("swipe");
  const lang = swipeLangOf(i18n.language);
  const deck = useSwipeDeck(lang);
  const [exitVerdict, setExitVerdict] = useState<SwipeVerdict | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const top = deck.cards[0];
  const next = deck.cards[1];
  const { data: details } = useSwipeCardDetails(top, lang);
  // Le verso de la suivante se charge pendant qu'on juge celle-ci, et elle le
  // porte déjà : une nouvelle carte arrive toujours côté affiche.
  const { data: nextDetails } = useSwipeCardDetails(next, lang);
  // La fiche d'un titre hors bibliothèque chez l'extension (Vigie), si elle
  // la donne ; celle de la suivante se lit d'avance, dans la même requête.
  const navigate = useNavigate();
  const { provider } = useTitleProvider();
  const topPage = useExternalTitleState(outsideTitle(top))?.page ?? null;
  useExternalTitleState(outsideTitle(next));
  const pageSlotOf = useCallback((card: SwipeCard) => !!provider && !card.jellyfinItemId, [provider]);
  const onOpenPage = useCallback((href: string) => navigate(href), [navigate]);
  const topKey = top?.key;
  useEffect(() => {
    setInfoOpen(false);
  }, [topKey]);

  const { judge, undo } = deck;
  const onJudge = useCallback(
    (verdict: SwipeVerdict) => {
      if (!top) return;
      setExitVerdict(verdict);
      setAnnounce(`${t(verdict)} — ${top.title}`);
      judge(verdict);
    },
    [top, judge, t]
  );
  const onUndo = useCallback(() => {
    if (!deck.canUndo) return;
    setExitVerdict(null);
    setAnnounce(t("undone"));
    undo();
  }, [deck.canUndo, undo, t]);
  const onToggleInfo = useCallback(() => setInfoOpen((v) => !v), []);

  // Z reste actif sur une pile vidée : la dernière carte peut toujours revenir.
  useSwipeKeyboard({ enabled: !!top || deck.canUndo, onJudge, onUndo, onToggleInfo });

  return (
    <div
      className={`row-gutter mx-auto flex w-full max-w-4xl flex-col items-center gap-4 pb-10 pt-2 ${
        // Hauteur de tout ce qui n'est pas la carte (cf. CARD_WIDTH), bandeau compris.
        deck.tmdbConfigured ? "[--swipe-chrome:27rem] sm:[--swipe-chrome:24rem]" : "[--swipe-chrome:31rem] sm:[--swipe-chrome:30rem]"
      }`}
    >
      <SwipeHeader counts={deck.counts} />
      {!deck.tmdbConfigured && <SwipeLibraryOnlyNotice />}

      {deck.loading ? (
        <SwipeSkeleton />
      ) : deck.error ? (
        <SwipeErrorState onRetry={deck.retry} />
      ) : deck.empty ? (
        <SwipeEmptyState />
      ) : (
        <SwipeStack
          cards={deck.cards}
          exitVerdict={exitVerdict}
          infoOpen={infoOpen}
          details={details}
          nextDetails={nextDetails}
          onJudge={onJudge}
          onToggleInfo={onToggleInfo}
          topPage={topPage}
          pageSlotOf={pageSlotOf}
          onOpenPage={onOpenPage}
        />
      )}

      {deck.saveFailed && <SwipeSaveFailedNotice onDismiss={deck.dismissSaveFailed} />}
      {!deck.error && !deck.empty && (
        <SwipeControls disabled={!top} canUndo={deck.canUndo} onJudge={onJudge} onUndo={onUndo} />
      )}
      {deck.empty && deck.canUndo && (
        <SwipeControls disabled canUndo onJudge={onJudge} onUndo={onUndo} />
      )}
      <SwipeShortcutsLegend />
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
