import { memo, useContext, useRef, useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, type SharedValue } from "react-native-reanimated";
import { OPEN_CARD_MOTION } from "@tentacle-tv/tv-core";
import { useTranslation } from "react-i18next";
import { useRemoteHints } from "../remote/remoteHints";
import { previewStoreContext } from "../cards/trailerPreviewPort";
import { MetaLine } from "../hero/MetaLine";
import { Icon } from "../icons/Icon";
import { motionTo } from "../motion/motion";
import { Reveal } from "../motion/Reveal";
import type { PreviewZoneModel } from "../previewZone/zoneModel";
import { ZoneSynopsis } from "../previewZone/ZoneSynopsis";
import { colors, fonts, white } from "../theme/tokens";

/**
 * Les DÉTAILS de la carte ouverte, sous elle (tv-core `cards/openCard.ts` : leur place
 * est réservée dans chaque rangée) : pourquoi ce titre est là, sa ligne de
 * métadonnées, son résumé en phrases entières (jamais un « … »), et ce que font OK
 * et OK maintenu. Un titre de la bibliothèque : le résumé arrive quand le focus a
 * tenu ; un titre absent : celui que l'extension joint (`AbsentModel.overview`),
 * sinon sa raison et l'état de sa demande — jamais une zone vide.
 *
 * Écrits par la scène de la page (`PreviewStageInfo.model`) ; seule la rangée du
 * titre focalisé les montre, et seule elle se redessine (sélecteur). Le focus
 * quitte la rangée (la barre de filtres, le rail) : ils s'effacent avec la carte
 * qui se referme (`rowFocus`, sur le fil d'interface) — la scène, elle, garde son
 * sujet.
 */
export const OpenDetails = memo(function OpenDetails({ ids, rowFocus, top, left, width, okHint }: {
  /** Les cartes de la rangée. */
  ids: ReadonlySet<string>;
  /** L'index focalisé de la rangée (-1 : le focus est ailleurs). */
  rowFocus: SharedValue<number>;
  top: number;
  left: number;
  width: number;
  /** Ce que fait OK sur un titre de la bibliothèque (« OK : ouvrir la fiche », « OK : reprendre »). */
  okHint?: string;
}) {
  const { t } = useTranslation("cards");
  const hints = useRemoteHints();
  const model = useRowModel(ids);
  // Le dernier modèle reste écrit le temps du fondu de sortie.
  const last = useRef(model);
  if (model) last.current = model;
  const said = last.current;
  const reduced = useReducedMotion();
  const inRow = useDerivedValue(() => {
    const on = rowFocus.value >= 0;
    return motionTo(on ? 1 : 0, on ? OPEN_CARD_MOTION.detailsInMs : OPEN_CARD_MOTION.detailsOutMs, reduced);
  });
  const rowFade = useAnimatedStyle(() => ({ opacity: inRow.value }));
  return (
    <Animated.View style={[styles.block, { top, left, width }, rowFade]} pointerEvents="none">
      <Reveal shown={model !== null}>
        {said ? <Details model={said} width={width} hint={okHint ?? t("okOpenDetails")} hold={t(hints.holdForOptions)} /> : null}
      </Reveal>
    </Animated.View>
  );
});

function Details({ model, width, hint, hold }: { model: PreviewZoneModel; width: number; hint: string; hold: string }) {
  // Un titre absent dit déjà, dans sa raison, ce que fait OK (« OK : demander »).
  const reasonIsHint = model.reason?.startsWith("OK") ?? false;
  return (
    <View style={styles.stack}>
      {model.reason && !reasonIsHint ? (
        <View style={styles.reason}>
          <Icon name="sparkles" size={22} color={colors.accentLight} />
          <Text style={styles.reasonText} numberOfLines={1}>{model.reason}</Text>
        </View>
      ) : null}
      {model.meta.length > 0 ? <MetaLine items={model.meta} singleLine /> : null}
      {model.synopsis ? <ZoneSynopsis synopsis={model.synopsis} lines={3} width={width} /> : null}
      <View style={styles.reason}>
        <Icon name="remote" size={22} color={colors.textTertiary} />
        <Text style={styles.hint} numberOfLines={1}>{`${reasonIsHint ? model.reason : hint} · ${hold}`}</Text>
      </View>
    </View>
  );
}

const NO_SUBSCRIBE = () => () => undefined;

/** Le modèle du titre focalisé, s'il est de cette rangée ; sinon `null` (aucun rendu). */
function useRowModel(ids: ReadonlySet<string>): PreviewZoneModel | null {
  const store = useContext(previewStoreContext);
  return useSyncExternalStore(store ? store.subscribe : NO_SUBSCRIBE, () => {
    if (!store) return null;
    const subject = store.getState().subject;
    const model = store.getInfo().model;
    return subject?.kind === "card" && ids.has(subject.id) && model?.key === `card:${subject.id}` ? model : null;
  });
}

const styles = StyleSheet.create({
  block: { position: "absolute" },
  stack: { gap: 10 },
  reason: { flexDirection: "row", alignItems: "center", gap: 10 },
  reasonText: { ...fonts.semibold, fontSize: 22, color: white(0.92), flexShrink: 1 },
  hint: { ...fonts.medium, fontSize: 21, color: colors.textTertiary, flexShrink: 1 },
});
