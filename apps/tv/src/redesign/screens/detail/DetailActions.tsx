import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { cardToggleLabelKey } from "@tentacle-tv/shared";
import { PillButton } from "../../controls/PillButton";
import { RoundButton } from "../../controls/RoundButton";
import { colors, fonts } from "../../theme/tokens";
import type { DetailActionsModel, DetailCallbacks } from "./detailTypes";

/**
 * La rangée d'actions de la fiche : UNE pilule blanche (Lecture ou
 * Reprendre, avec sa jauge), la pilule de verre « Bande-annonce » quand le
 * titre en a une, puis les ronds dans l'ordre de la pastille des cartes —
 * Ma liste, favori, vu — et « Noter ». Un rond ne dit ce qu'il fait qu'au
 * focus, en dessous de lui : la rangée garde donc de la place sous elle.
 *
 * Contrat : `useCardToggles` (Ma liste, favori, vu et leurs bascules — la
 * logique unique des cartes), `useCardRatingTarget` (la note, et si le titre
 * peut être noté), `useSeriesWatchState` (le libellé d'une série),
 * `useItemTrailer` (la bande-annonce).
 */

type Props = Pick<
  DetailCallbacks,
  "onPlay" | "onTrailer" | "onToggleWatchlist" | "onToggleFavorite" | "onToggleWatched" | "onRate"
> & {
  actions: DetailActionsModel;
  onFocusChange?: (focused: boolean) => void;
};

export const DetailActions = memo(function DetailActions({
  actions,
  onFocusChange,
  onPlay,
  onTrailer,
  onToggleWatchlist,
  onToggleFavorite,
  onToggleWatched,
  onRate,
}: Props) {
  const { t } = useTranslation();
  const score = actions.rating?.score ?? null;
  return (
    <View>
      <View style={styles.row}>
        {actions.play ? (
          <PillButton
            variant="brand"
            icon="play"
            label={actions.play.label}
            progress={actions.play.progress}
            focusKey="detail:primary"
            onPress={onPlay}
            onFocusChange={onFocusChange}
          />
        ) : null}
        {actions.trailer ? (
          <PillButton
            variant="glass"
            icon="trailer"
            label={t("common:trailer")}
            focusKey="detail:trailer"
            onPress={onTrailer}
            onFocusChange={onFocusChange}
          />
        ) : null}
        <View style={styles.rounds}>
          <RoundButton
            icon="plus"
            activeIcon="check"
            active={actions.watchlist}
            label={t(`cards:${cardToggleLabelKey("watchlist", actions.watchlist)}`)}
            focusKey="detail:list"
            onPress={onToggleWatchlist}
            onFocusChange={onFocusChange}
          />
          <RoundButton
            icon="heart"
            activeIcon="heartFilled"
            active={actions.favorite}
            label={t(`cards:${cardToggleLabelKey("favorite", actions.favorite)}`)}
            focusKey="detail:favorite"
            onPress={onToggleFavorite}
            onFocusChange={onFocusChange}
          />
          <RoundButton
            icon="watched"
            active={actions.watched}
            label={t(`cards:${cardToggleLabelKey("watched", actions.watched)}`)}
            focusKey="detail:watched"
            onPress={onToggleWatched}
            onFocusChange={onFocusChange}
          />
          {actions.rating ? (
            <RoundButton
              icon="starOutline"
              activeIcon="star"
              active={score !== null}
              label={score !== null ? t("media:detailYourScoreValue", { score }) : t("cards:rateTitle")}
              focusKey="detail:rate"
              onPress={onRate}
              onFocusChange={onFocusChange}
            />
          ) : null}
        </View>
      </View>
      {actions.play?.caption ? <Text style={styles.caption} numberOfLines={1}>{actions.play.caption}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 20 },
  rounds: { flexDirection: "row", alignItems: "center", gap: 18, marginLeft: 6 },
  caption: { ...fonts.medium, fontSize: 22, color: colors.textTertiary, marginTop: 14, marginLeft: 36 },
});
