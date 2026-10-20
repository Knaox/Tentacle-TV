import { useCallback } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  WtApiError, applyAffinityPush, closeAffinity, dismissAffinityMatch, getAffinitySnapshot, launchAffinityMatch,
  leaveAffinity, showAffinityNotice, showAffinityView, useAffinityStore, useResolvePlayTarget, useWatchTogether,
} from "@tentacle-tv/api-client";
import type { MediaItem, WtAffinityMatchDto, WtAffinityStateDto } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { CONTENT_MAX_WIDTH, useResponsive, useTheme } from "@/theme";
import { useGatedModal } from "@/components/ui/useGatedModal";
import { AffinityDeckScreen } from "./AffinityDeckScreen";
import { AffinityKindsView } from "./AffinityKindsView";
import { AffinityMatchNative } from "./AffinityMatchNative";
import { AffinityNoticeNative } from "./AffinityNoticeNative";

/**
 * La modale de l'affinité sur le mobile — plein écran partout : sur iPad,
 * une « page sheet » laissait l'accueil dépasser en haut et son glisser vers
 * le bas concurrençait la pile. Le contenu y tient dans une colonne centrée
 * de 640 pt (`CONTENT_MAX_WIDTH`) : en-tête, carte et boutons groupés. Ses vues : le choix du type, la pile, et le match,
 * qui ne se choisit pas (le premier en attente s'affiche chez tous à la fois).
 * Sous le match, la pile reste MONTÉE (cachée) : rien ne se recharge.
 * Fermer (Retour Android, « Quitter »), c'est QUITTER l'affinité.
 * Elle ne se présente qu'une fois la feuille du groupe retirée
 * (`useGatedModal`) : présentée pendant sa sortie, iOS la refusait et l'app
 * restait figée (« Trouver quoi regarder », alpha du 21/10).
 */

/** La sortie « slide » d'UIKit, à laisser finir avant de présenter autre chose. */
const SLIDE_EXIT_MS = 450;

export function AffinityModalNative({ onStale, onOpenTitle }: {
  onStale: () => void;
  onOpenTitle: (target: { watchId: string } | { detailId: string }) => void;
}) {
  const { modal, state } = useAffinityStore();
  const { room, selfId } = useWatchTogether();
  const { t } = useTranslation("watchTogether");
  const theme = useTheme();
  const resolvePlayTarget = useResolvePlayTarget();
  const { isTablet } = useResponsive();

  const quit = useCallback(() => {
    if (getAffinitySnapshot().state) void leaveAffinity().catch(() => undefined);
    closeAffinity();
  }, []);

  const onWatch = useCallback(async (match: WtAffinityMatchDto) => {
    await launchAffinityMatch(match.key);
    const item = { Id: match.itemId, Type: match.mediaType === "tv" ? "Series" : "Movie" } as MediaItem;
    const target = await resolvePlayTarget(item).catch(() => null);
    closeAffinity();
    onOpenTitle(target ? { watchId: target } : { detailId: match.itemId });
  }, [resolvePlayTarget, onOpenTitle]);

  const onKeepSwiping = useCallback(async (match: WtAffinityMatchDto) => {
    applyAffinityPush(await dismissAffinityMatch(match.key));
  }, []);

  const failed = useCallback((err: unknown) => {
    if (!(err instanceof WtApiError && err.code === "answered")) showAffinityNotice(null, t("errorGeneric"));
    throw err;
  }, [t]);

  const { presented, onShow } = useGatedModal(modal.open, SLIDE_EXIT_MS);
  if (!presented) return null;
  const participant = !!state && state.participants.some((p) => p.userId === selfId);
  const proposal = participant && state ? (state.proposals[0] ?? null) : null;
  const view = !state ? "kinds" : proposal ? "match" : modal.view;
  const deckMounted = !!state && view !== "kinds";

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={view === "kinds" && state ? () => showAffinityView("deck") : quit}
      onShow={onShow}
      supportedOrientations={["portrait", "landscape"]}
    >
      <SafeAreaView style={[st.root, { backgroundColor: theme.colors.surface.s0 }]} edges={["top", "bottom", "left", "right"]}>
        <AffinityNoticeNative />
        <View style={[st.fill, isTablet && st.column]}>
        {deckMounted && state && (
          <View style={view === "match" ? st.hidden : st.fill}>
            <AffinityDeckScreen
              key={state.sessionId}
              state={state}
              room={room}
              selfId={selfId}
              onQuit={quit}
              onStale={onStale}
              onMatch={(next: WtAffinityStateDto) => { applyAffinityPush(next); }}
              onChangeKind={() => showAffinityView("kinds")}
            />
          </View>
        )}
        {view === "kinds" && (
          <AffinityKindsView
            state={state}
            onStarted={(next) => { applyAffinityPush(next); showAffinityView("deck"); }}
            onBack={() => showAffinityView("deck")}
            onClose={closeAffinity}
          />
        )}
        {view === "match" && state && proposal && (
          <AffinityMatchNative
            match={proposal}
            room={room}
            selfId={selfId}
            participantCount={state.participants.length}
            onWatch={() => onWatch(proposal).catch(failed)}
            onKeepSwiping={() => onKeepSwiping(proposal).catch(failed)}
          />
        )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  column: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
  hidden: { display: "none" },
});
