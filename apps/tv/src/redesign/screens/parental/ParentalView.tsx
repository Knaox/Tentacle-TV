import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { PARENTAL_BACK_BAR_KEY, PARENTAL_BACK_KEY } from "@tentacle-tv/tv-core";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { ActivitySpinner } from "../../controls/ActivitySpinner";
import { BACK_BUTTON_SIZE, BACK_TOP, BackButton } from "../../controls/BackButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { Icon } from "../../icons/Icon";
import { MOTION_ENABLED } from "../../motion/motion";
import { colors, fonts, text } from "../../theme/tokens";
import { ProfileAvatar } from "../profiles/ProfileAvatar";
import { PROFILES_PALETTE } from "../profiles/profileColors";
import { StatusPanel } from "../shared/StatusPanel";
import { ParentalAgeSection } from "./ParentalAgeSection";
import { ParentalLibrariesSection } from "./ParentalLibrariesSection";
import type { ParentalNotice, ParentalViewProps } from "./parentalTypes";

export type {
  ParentalAgeChipView,
  ParentalAgeView,
  ParentalLibrariesView,
  ParentalLibraryView,
  ParentalNotice,
  ParentalViewModel,
  ParentalViewProps,
} from "./parentalTypes";

/**
 * Le CONTRÔLE PARENTAL simplifié d'un profil (`ParentalControls`, Apple TV et
 * Android TV) — ouvert depuis « Gérer les profils » par le propriétaire ou un
 * parent, sur un invité ou un membre mineur. Deux réglages, rien de plus :
 * l'âge maximal en quelques paliers, les bibliothèques autorisées. Chaque geste
 * part aussitôt au serveur, qui l'écrit dans la politique Jellyfin du profil ;
 * le reste se règle ailleurs, et la page le dit (« Plus d'options sur le bureau
 * ou le web »).
 *
 * En tête : le rond du profil, son nom, ce qu'il est. Au pied : le renvoi, et
 * l'état du dernier geste (enregistrement, enregistré, refus). La croix Retour,
 * en haut à gauche comme partout, ramène à la gestion : rien n'est à valider.
 *
 * Clés : `parental:back` et sa bande `parental:top` ; celles des deux sections ;
 * `status:primary`.
 */
export const ParentalView = memo(function ParentalView(props: ParentalViewProps) {
  const { model } = props;
  const { t } = useTranslation(["parentalTv", "common"]);
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={PROFILES_PALETTE} intensity={1.1} />
      <Animated.View key={model.kind} entering={MOTION_ENABLED ? FadeIn.duration(240) : undefined} style={styles.fill}>
        {model.kind === "loading" ? <StatusPanel kind="loading" title={t("parentalTv:kicker")} inset={0} /> : null}
        {model.kind === "error" ? (
          <StatusPanel
            kind="error"
            title={t("parentalTv:kicker")}
            message={model.message}
            inset={0}
            primary={model.retry ? { label: t("common:retry"), icon: "refresh", onPress: props.onRetry } : undefined}
          />
        ) : null}
        {model.kind === "ready" ? (
          <View style={styles.page}>
            <View style={styles.header}>
              <ProfileAvatar name={model.name} color={model.color} uri={model.avatarUri} size={120} />
              <View style={styles.headerText}>
                <Text style={styles.kicker} numberOfLines={1}>{`${t("parentalTv:kicker")} · ${model.role}`}</Text>
                <Text style={styles.title} numberOfLines={1}>{t("parentalTv:title", { name: model.name })}</Text>
                <Text style={styles.subtitle}>{t("parentalTv:subtitle")}</Text>
              </View>
            </View>
            <View style={styles.body}>
              {model.age ? (
                <View style={styles.column}>
                  <ParentalAgeSection age={model.age} onAge={props.onAge} />
                </View>
              ) : null}
              {model.libraries ? (
                <View style={styles.column}>
                  <ParentalLibrariesSection libraries={model.libraries} onLibrary={props.onLibrary} />
                </View>
              ) : null}
            </View>
            <View style={styles.footer}>
              <View style={styles.more}>
                <Icon name="sliders" size={28} color={colors.textSecondary} />
                <View style={styles.moreText}>
                  <Text style={styles.moreTitle}>{t("parentalTv:more.title")}</Text>
                  <Text style={styles.moreDetail}>{t("parentalTv:more.detail")}</Text>
                </View>
              </View>
              <NoticeLine notice={model.notice} />
            </View>
          </View>
        ) : null}
        {model.kind !== "loading" ? (
          <FocusGroup focusKey={PARENTAL_BACK_BAR_KEY} style={styles.backBar}>
            <BackButton focusKey={PARENTAL_BACK_KEY} onPress={props.onBack} />
          </FocusGroup>
        ) : null}
      </Animated.View>
    </View>
  );
});

/** L'état du dernier geste ; la place reste tenue, la page ne saute pas. */
function NoticeLine({ notice }: { notice: ParentalNotice | null }) {
  if (!notice) return <View style={styles.notice} />;
  const color = notice.tone === "error" ? colors.warningFg : notice.tone === "success" ? colors.successFg : colors.textSecondary;
  return (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      {notice.tone === "progress" ? <ActivitySpinner color={colors.textSecondary} /> : null}
      {notice.tone === "success" ? <Icon name="check" size={26} color={color} strokeWidth={2.6} /> : null}
      {notice.tone === "error" ? <Icon name="alert" size={26} color={color} /> : null}
      <Text style={[styles.noticeText, { color }]} numberOfLines={2}>{notice.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  page: {
    flex: 1,
    paddingTop: BACK_TOP + BACK_BUTTON_SIZE + 24,
    paddingBottom: TV_STAGE.safe.y,
    paddingHorizontal: TV_STAGE.safe.x + 40,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 36 },
  headerText: { flex: 1 },
  kicker: { ...text.kicker, marginBottom: 10 },
  title: { ...text.title },
  subtitle: { ...text.meta, marginTop: 8 },
  body: { flex: 1, flexDirection: "row", gap: 96, marginTop: 52 },
  column: { flex: 1, maxWidth: 900 },
  footer: { flexDirection: "row", alignItems: "center", gap: 48, paddingTop: 24 },
  more: { flex: 1, flexDirection: "row", alignItems: "center", gap: 18 },
  moreText: { flexShrink: 1 },
  moreTitle: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  moreDetail: { ...text.caption, marginTop: 4 },
  notice: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 14, minHeight: 40 },
  noticeText: { ...fonts.medium, fontSize: 24, flexShrink: 1, textAlign: "right" },
  backBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BACK_TOP + BACK_BUTTON_SIZE,
    paddingTop: BACK_TOP,
    paddingLeft: TV_STAGE.safe.x,
    flexDirection: "row",
    alignItems: "flex-start",
  },
});
