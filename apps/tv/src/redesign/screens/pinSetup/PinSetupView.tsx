import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { FamilyProfileColor } from "@tentacle-tv/shared";
import { TV_STAGE } from "@tentacle-tv/theme";
import { PIN_SETUP_ACTIONS_GROUP, PIN_SETUP_CREATE_KEY, PIN_SETUP_LATER_KEY, type PinSetupReason } from "@tentacle-tv/tv-core";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { MOTION_ENABLED } from "../../motion/motion";
import { colors, text, white } from "../../theme/tokens";
import { ProfileAvatar } from "../profiles/ProfileAvatar";
import { PROFILES_PALETTE, profilePalette } from "../profiles/profileColors";

export interface PinSetupProfile {
  name: string;
  color: FamilyProfileColor;
  /** Le portrait Jellyfin ; absent → l'initiale. */
  avatarUri?: string;
}

export type PinSetupModel =
  /** On ne sait pas encore (ou l'étape cède la place) : la lumière seule, rien à lire. */
  | { kind: "waiting" }
  | { kind: "offer"; profile: PinSetupProfile; reason: PinSetupReason };

/**
 * Le CODE PIN CONSEILLÉ (`PinSetup`, Apple TV et Android TV) — la première
 * fenêtre du premier passage dans un profil, avant la barre. À gauche, le
 * portrait du profil et son cadenas, tel que « Qui regarde ? » le montrera ;
 * à droite, pourquoi c'est conseillé (et, pour qui gérerait la famille avec un
 * code, qu'il lui servira aussi à ça), puis l'action principale « Créer un
 * code PIN » et « Plus tard ». Dessous, où le retrouver : Réglages › Compte.
 * La lumière prend la couleur du profil ; aucune croix — Retour vaut « Plus
 * tard », décidé par l'intégration.
 *
 * Clés : `pinSetup:create`, `pinSetup:later` ; groupe `pinSetup:actions`.
 */
export const PinSetupView = memo(function PinSetupView({ model, onCreate, onLater }: {
  model: PinSetupModel;
  onCreate?: () => void;
  onLater?: () => void;
}) {
  const { t } = useTranslation("familyTv");
  const color = model.kind === "offer" ? model.profile.color : null;
  const palette = useMemo(() => (color ? profilePalette(color) : PROFILES_PALETTE), [color]);
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} intensity={1.1} />
      {model.kind === "offer" ? (
        <Animated.View entering={MOTION_ENABLED ? FadeIn.duration(260) : undefined} style={styles.stage}>
          <View style={styles.portrait}>
            <ProfileAvatar name={model.profile.name} color={model.profile.color} uri={model.profile.avatarUri} size={AVATAR} />
            <View style={styles.lock}>
              <GlassSurface radius={LOCK / 2} tone="clear" style={StyleSheet.absoluteFill} />
              <Icon name="lock" size={42} color={colors.text} strokeWidth={2.4} />
            </View>
          </View>
          <View style={styles.copy}>
            <Text style={styles.kicker} numberOfLines={1}>{t("pinSetup.kicker", { name: model.profile.name })}</Text>
            <Text style={styles.title}>{t("pinSetup.title")}</Text>
            <Text style={styles.body}>{t(`pinSetup.${model.reason}`)}</Text>
            <Text style={styles.note}>{t("pinSetup.sameCode")}</Text>
            <FocusGroup focusKey={PIN_SETUP_ACTIONS_GROUP} style={styles.actions}>
              <PillButton variant="primary" label={t("pinSetup.create")} icon="lock" focusKey={PIN_SETUP_CREATE_KEY} onPress={onCreate} />
              <PillButton label={t("pinSetup.later")} focusKey={PIN_SETUP_LATER_KEY} onPress={onLater} />
            </FocusGroup>
            <Text style={styles.hint}>{t("pinSetup.settingsHint")}</Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
});

const AVATAR = 300;
const LOCK = 104;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  stage: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 110,
    paddingHorizontal: TV_STAGE.safe.x + 40,
  },
  portrait: { width: AVATAR, height: AVATAR },
  // Le cadenas mord sur le bas du portrait : le profil sera fermé par son code.
  lock: {
    position: "absolute",
    right: -8,
    bottom: -8,
    width: LOCK,
    height: LOCK,
    borderRadius: LOCK / 2,
    borderWidth: 2,
    borderColor: white(0.22),
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  copy: { flexShrink: 1, maxWidth: 1000 },
  kicker: { ...text.kicker, marginBottom: 16 },
  title: { ...text.title, marginBottom: 22 },
  body: { ...text.body, color: colors.text, marginBottom: 12 },
  note: { ...text.body, marginBottom: 44 },
  // Une marge où le bouton focalisé grandit sans être coupé.
  actions: { flexDirection: "row", gap: 24, alignItems: "center", paddingVertical: 8, paddingHorizontal: 4 },
  hint: { ...text.caption, marginTop: 30, paddingHorizontal: 4 },
});
