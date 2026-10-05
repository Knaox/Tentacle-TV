import { forwardRef, memo, useCallback, useImperativeHandle, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, fonts, scrim } from "../../theme/tokens";
import { useKeyboardEntry } from "./keyboardOpener";

/**
 * Un champ du jumelage — l'adresse du serveur, l'identifiant, le mot de passe :
 * une grande pastille de verre, blanche au focus, son pictogramme et sa valeur
 * (son invite, vide). OK ouvre le clavier système : la saisie passe par un
 * `TextInput` INVISIBLE (le champ natif de tvOS dessinerait sa propre pastille
 * grise dans la nôtre) — à opacité nulle, le moteur de focus ne le choisit
 * jamais ; le champ affiché n'est qu'un texte. Un mot de passe n'y paraît
 * qu'en points, et son clavier masque la saisie.
 *
 * `open()` ouvre le clavier depuis un autre bouton (« Se connecter » vers
 * le premier champ vide) — toujours sur un appui : demandé pendant qu'un
 * autre clavier se retire, il ne s'ouvre pas (mesuré). Avec `caption`, le
 * libellé se lit AU-DESSUS du champ, toujours visible ; l'invite, elle,
 * titre aussi le clavier système.
 *
 * Le geste natif d'ouverture n'est pas ici : la plateforme le fournit
 * (`useKeyboardEntry`, son applicateur) — il oublie d'abord un focus périmé
 * du champ, qu'un clavier qui n'a pas paru laisse derrière lui.
 */

export interface PairingFieldHandle {
  open: () => void;
}

export interface PairingFieldProps {
  focusKey: string;
  icon: IconName;
  /** Le libellé : lu par VoiceOver, et écrit au-dessus du champ avec `caption`. */
  label: string;
  caption?: boolean;
  value: string;
  placeholder: string;
  /** Une vérification en cours : la roue au bout du champ. */
  busy?: boolean;
  secure?: boolean;
  /** Ce que le clavier système doit savoir (type, remplissage automatique, touche de validation). */
  keyboard: Pick<TextInputProps, "keyboardType" | "textContentType" | "returnKeyType" | "autoComplete">;
  onChangeText?: (value: string) => void;
  onSubmitEditing?: () => void;
}

export const FIELD = { width: 1100, height: 108, radius: 34 };

/** Au-delà, les points d'un mot de passe ne disent plus rien de plus. */
const MAX_DOTS = 24;

export const PairingField = memo(
  forwardRef<PairingFieldHandle, PairingFieldProps>(function PairingField(
    { focusKey, icon, label, caption, value, placeholder, busy = false, secure = false, keyboard, onChangeText, onSubmitEditing },
    ref,
  ) {
    const input = useRef<TextInput>(null);
    const entry = useKeyboardEntry();
    const openKeyboard = entry?.open;
    const open = useCallback(() => {
      const field = input.current;
      if (field) openKeyboard?.(field, focusKey);
    }, [openKeyboard, focusKey]);
    useImperativeHandle(ref, () => ({ open }), [open]);
    const shown = secure ? "•".repeat(Math.min(value.length, MAX_DOTS)) : value;
    return (
      <View style={styles.block}>
        {caption ? <Text style={styles.caption}>{label}</Text> : null}
        <FocusTarget focusKey={focusKey} form="row" onPress={open} accessibilityLabel={label}>
          {(focused) => <Face focused={focused} icon={icon} shown={shown} placeholder={placeholder} busy={busy} />}
        </FocusTarget>
        <TextInput
          ref={input}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          {...keyboard}
          {...entry?.hiddenInputProps}
          style={styles.hiddenInput}
        />
      </View>
    );
  }),
);

function Face({ focused, icon, shown, placeholder, busy }: { focused: boolean; icon: IconName; shown: string; placeholder: string; busy: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.025 * p.value }] }));
  const onLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const offLayer = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const ink = focused ? colors.ctaFg : colors.text;
  const empty = shown.length === 0;
  return (
    <Animated.View style={[styles.field, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fieldShadow, onLayer]} />
      <Animated.View style={[StyleSheet.absoluteFill, offLayer]}>
        <GlassSurface radius={FIELD.radius} tone="clear" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fieldWhite, onLayer]} />
      <View style={styles.fieldRow}>
        <Icon name={icon} size={32} color={focused ? colors.ctaFg : colors.textSecondary} strokeWidth={2.2} />
        <Text
          style={[styles.value, { color: empty ? (focused ? scrim(0.4) : colors.textQuaternary) : ink }]}
          numberOfLines={1}
        >
          {empty ? placeholder : shown}
        </Text>
        {busy ? <ActivityIndicator size="large" color={ink} /> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: "flex-start" },
  caption: {
    ...fonts.bold,
    fontSize: 22,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.textTertiary,
    marginBottom: 12,
    marginLeft: 8,
  },
  field: { width: FIELD.width, height: FIELD.height, borderRadius: FIELD.radius },
  fieldShadow: {
    borderRadius: FIELD.radius,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
  },
  fieldWhite: { borderRadius: FIELD.radius, backgroundColor: colors.ctaBg },
  fieldRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 36 },
  value: { ...fonts.semibold, flex: 1, fontSize: 36, lineHeight: 44 },
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
