import { memo } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { AVATAR_GALLERY_ACTIONS_GROUP, AVATAR_GALLERY_LATER_KEY, type AvatarGalleryPhase } from "@tentacle-tv/tv-core";
import type { AvatarCollection } from "@tentacle-tv/shared";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { Icon } from "../../icons/Icon";
import { MOTION_ENABLED } from "../../motion/motion";
import { useRemoteHints } from "../../remote/remoteHints";
import { colors, text, white } from "../../theme/tokens";
import type { AvatarGalleryCharacter } from "./avatarGalleryTypes";
import { useTemperamentMotion } from "./temperamentMotion";

/** Le diamètre du grand portrait. */
const PORTRAIT = 260;

/**
 * Le panneau de la galerie : on y fait connaissance. La question en tête
 * (« Choisissez votre personnage »), puis le personnage que le focus désigne
 * — son grand portrait, qui fait son geste en arrivant, sa collection, son
 * nom, son histoire —, puis l'état du choix et « Plus tard ».
 */
export const AvatarStoryPanel = memo(function AvatarStoryPanel({ character, collection, guestName, phase, onLater }: {
  /** Le personnage désigné (ou en cours d'envoi) ; null : la grille est vide. */
  character: AvatarGalleryCharacter | null;
  collection: AvatarCollection | null;
  guestName: string | null;
  phase: AvatarGalleryPhase;
  onLater?: () => void;
}) {
  const { t } = useTranslation("avatars");
  // Le groupe couvre toute la colonne : GAUCHE depuis n'importe quelle ligne de la grille y entre.
  return (
    <FocusGroup focusKey={AVATAR_GALLERY_ACTIONS_GROUP} style={styles.panel}>
      <Text style={styles.kicker} numberOfLines={1}>{guestName ? t("guest.title", { name: guestName }) : t("title")}</Text>
      <Text style={styles.title} numberOfLines={2}>{guestName ? t("tv.titleGuest", { name: guestName }) : t("invite.title")}</Text>
      <Text style={styles.subtitle} numberOfLines={2}>{guestName ? t("tv.subtitleGuest") : t("tv.subtitle")}</Text>
      {character ? (
        <Animated.View key={character.id} entering={MOTION_ENABLED ? FadeIn.duration(200) : undefined} style={styles.meet}>
          <Portrait character={character} />
          {collection ? <Text style={styles.collection}>{t(`collections.${collection}`)}</Text> : null}
          <Text style={styles.name} numberOfLines={1}>{t(`characters.${character.id}.name`)}</Text>
          <Text style={styles.story} numberOfLines={3}>{t(`characters.${character.id}.story`)}</Text>
        </Animated.View>
      ) : null}
      <View style={styles.fill} />
      <Status character={character} guestName={guestName} phase={phase} />
      <View style={styles.actions}>
        <PillButton label={t("tv.later")} icon="clock" size="md" focusKey={AVATAR_GALLERY_LATER_KEY} onPress={onLater} />
      </View>
    </FocusGroup>
  );
});

/** Le grand portrait : la vignette d'abord (déjà là), l'image entière par-dessus dès qu'elle arrive. */
function Portrait({ character }: { character: AvatarGalleryCharacter }) {
  const motion = useTemperamentMotion(character.temperament, character.id);
  return (
    <Animated.View style={[styles.portrait, { backgroundColor: character.tone }, motion]}>
      <Image source={character.thumb} style={StyleSheet.absoluteFill} fadeDuration={0} />
      <Image source={character.portrait} style={StyleSheet.absoluteFill} fadeDuration={0} />
    </Animated.View>
  );
}

/** Ce que devient le choix : l'indication de la touche, l'attente, la réussite ou l'échec. */
function Status({ character, guestName, phase }: { character: AvatarGalleryCharacter | null; guestName: string | null; phase: AvatarGalleryPhase }) {
  const { t } = useTranslation("avatars");
  const hints = useRemoteHints();
  const name = character ? t(`characters.${character.id}.name`) : "";
  if (phase.kind === "sending") {
    return (
      <View style={styles.status}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
        <Text style={styles.statusText}>{t("applying")}</Text>
      </View>
    );
  }
  if (phase.kind === "done") {
    return (
      <View style={styles.status}>
        <Icon name="check" size={28} color={colors.accentLight} strokeWidth={2.6} />
        <Text style={[styles.statusText, styles.done]} numberOfLines={2}>
          {guestName ? t("tv.doneGuest", { name, guest: guestName }) : t("tv.done", { name })}
        </Text>
      </View>
    );
  }
  if (phase.failedId !== null) {
    return (
      <View style={styles.status}>
        <Icon name="alert" size={28} color={colors.warningFg} strokeWidth={2.4} />
        <Text style={[styles.statusText, styles.failed]} numberOfLines={2}>{t("tv.failed")}</Text>
      </View>
    );
  }
  return (
    <View style={styles.status}>
      <Text style={styles.statusText} numberOfLines={1}>{character ? t(hints.avatarChoose, { name }) : " "}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  kicker: { ...text.kicker, marginBottom: 14 },
  title: { ...text.title, marginBottom: 12 },
  subtitle: { ...text.body, color: colors.textSecondary },
  meet: { marginTop: 40 },
  portrait: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: PORTRAIT / 2,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: white(0.16),
    marginBottom: 32,
  },
  collection: { ...text.caption, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 2.4, marginBottom: 6 },
  name: { ...text.heading, marginBottom: 10 },
  story: { ...text.body, color: colors.textSecondary },
  fill: { flex: 1 },
  status: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 40, marginBottom: 20 },
  statusText: { ...text.meta, color: colors.textTertiary, flexShrink: 1 },
  done: { color: colors.text },
  failed: { color: colors.warningFg },
  actions: { flexDirection: "row", alignItems: "center" },
});
