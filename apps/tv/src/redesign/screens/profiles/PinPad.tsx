import { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { FAMILY_PIN_LENGTH } from "@tentacle-tv/shared";
import { PIN_DIGITS, PIN_ERASE_KEY, PIN_PAD_GROUP, pinDigitKey } from "@tentacle-tv/tv-core";
import { FocusGroup } from "../../focus/FocusGroup";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon, type IconName } from "../../icons/Icon";
import { pressScale, usePressProgress } from "../../motion/pressProgress";
import { colors, fonts, text, white } from "../../theme/tokens";
import { ProfileAvatar } from "./ProfileAvatar";
import type { PinPadModel } from "./profilesTypes";

/**
 * Le pavé du code PIN : le profil, quatre points, et les dix chiffres sur une
 * RANGÉE — le code de l'Apple TV elle-même : GAUCHE / DROITE (ou un glisser)
 * les parcourent, OK tape. ⌫ au bout. Le quatrième chiffre part au serveur ;
 * la TV ne juge rien. Bloqué, les touches s'éteignent et la ligne dit l'heure
 * de reprise ; seule la croix reste.
 *
 * Clés : `pin:digit:<0-9>`, `pin:erase` ; groupe `pin:pad`.
 */
export const PinPad = memo(function PinPad({ pad, onDigit, onErase }: {
  pad: PinPadModel;
  onDigit?: (digit: string) => void;
  onErase?: () => void;
}) {
  const { t } = useTranslation("familyTv");
  const silent = pad.phase === "locked";
  const tone = pad.phase === "wrong" || pad.phase === "locked" ? colors.warningFg : colors.textSecondary;
  return (
    <View style={styles.root}>
      <ProfileAvatar name={pad.profile.name} color={pad.profile.color} uri={pad.profile.avatarUri} size={150} />
      <Text style={styles.title} numberOfLines={1}>{pad.title}</Text>
      <Text style={styles.prompt}>{pad.hint ?? t("pin.prompt")}</Text>
      <View style={styles.dots} accessibilityLabel={`${pad.typed} / ${FAMILY_PIN_LENGTH}`}>
        {Array.from({ length: FAMILY_PIN_LENGTH }, (_, index) => (
          <View key={index} style={[styles.dot, index < pad.typed ? styles.dotFull : null]} />
        ))}
      </View>
      <View style={styles.status}>
        {pad.phase === "checking" ? (
          <View style={styles.checking}>
            <ActivityIndicator color={colors.textSecondary} />
            <Text style={[styles.message, { color: colors.textSecondary }]}>{t("pin.checking")}</Text>
          </View>
        ) : pad.message ? (
          <Text style={[styles.message, { color: tone }]}>{pad.message}</Text>
        ) : null}
      </View>
      <FocusGroup focusKey={PIN_PAD_GROUP} style={styles.keys}>
        {PIN_DIGITS.map((digit) => (
          <PinKey
            key={digit}
            focusKey={pinDigitKey(digit)}
            label={digit}
            accessibilityLabel={t("pin.digit", { digit })}
            disabled={silent}
            onPress={onDigit ? () => onDigit(digit) : undefined}
          />
        ))}
        <PinKey focusKey={PIN_ERASE_KEY} icon="backspace" accessibilityLabel={t("pin.erase")} disabled={silent} onPress={onErase} />
      </FocusGroup>
    </View>
  );
});

const KEY = 92;

const PinKey = memo(function PinKey({ focusKey, label, icon, accessibilityLabel, disabled, onPress }: {
  focusKey: string;
  label?: string;
  icon?: IconName;
  accessibilityLabel: string;
  disabled: boolean;
  onPress?: () => void;
}) {
  return (
    <FocusTarget focusKey={focusKey} onPress={onPress} disabled={disabled} accessibilityLabel={accessibilityLabel}>
      {(focused) => <KeyBody label={label} icon={icon} focused={focused} disabled={disabled} />}
    </FocusTarget>
  );
});

function KeyBody({ label, icon, focused, disabled }: { label?: string; icon?: IconName; focused: boolean; disabled: boolean }) {
  const p = useFocusProgress(focused);
  const press = usePressProgress();
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: (1 + 0.14 * p.value) * pressScale(press ? press.value : 0) }] }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const ink = focused ? colors.ctaFg : colors.text;
  return (
    <Animated.View style={[styles.key, disabled ? styles.keyOff : null, lift]}>
      <GlassSurface radius={KEY / 2} tone="clear" style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.keyWhite, whiteLayer]} />
      {icon ? (
        <Icon name={icon} size={34} color={ink} strokeWidth={2.4} />
      ) : (
        <Text style={[styles.keyLabel, { color: ink }]}>{label}</Text>
      )}
    </Animated.View>
  );
}

const DOT = 26;

const styles = StyleSheet.create({
  root: { alignItems: "center" },
  title: { ...text.title, marginTop: 34, textAlign: "center" },
  prompt: { ...text.body, marginTop: 10, textAlign: "center" },
  dots: { flexDirection: "row", gap: 30, marginTop: 44 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 3, borderColor: white(0.6) },
  dotFull: { backgroundColor: colors.text, borderColor: colors.text },
  status: { height: 64, justifyContent: "center", alignItems: "center", marginTop: 18 },
  checking: { flexDirection: "row", alignItems: "center", gap: 14 },
  message: { ...fonts.semibold, fontSize: 28, lineHeight: 36, textAlign: "center" },
  keys: { flexDirection: "row", gap: 18, marginTop: 18 },
  key: { width: KEY, height: KEY, borderRadius: KEY / 2, alignItems: "center", justifyContent: "center" },
  keyOff: { opacity: 0.35 },
  keyWhite: { borderRadius: KEY / 2, backgroundColor: colors.ctaBg },
  keyLabel: { ...fonts.bold, fontSize: 40 },
});
