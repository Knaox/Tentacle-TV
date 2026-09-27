import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { FONT_FAMILY, useTheme, useThemedStyles } from "@/theme";
import { makeAuthStyles } from "./authStyles";

interface AuthPrimaryButtonProps {
  label: string;
  /** Libellé pendant la requête (« Connexion… ») ; l'anneau l'accompagne. */
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Le CTA des écrans d'avant connexion : pilule `cta.primaryBg` et halo violet
 * (`makeAuthStyles.primaryCta`). En cours de requête, l'anneau ET un libellé
 * — un anneau seul ne dit rien au lecteur d'écran.
 */
export function AuthPrimaryButton({ label, loadingLabel, loading = false, disabled = false, onPress, style }: AuthPrimaryButtonProps) {
  const { colors } = useTheme();
  const auth = useThemedStyles(makeAuthStyles);
  const inactive = disabled || loading;
  const text = loading && loadingLabel ? loadingLabel : label;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        auth.primaryCta,
        { minHeight: 50, flexDirection: "row", gap: 10, opacity: disabled && !loading ? 0.5 : pressed ? 0.88 : 1 },
        style,
      ]}
    >
      {loading && <ActivityIndicator color={colors.cta.primaryFg} size="small" />}
      <Text style={{ color: colors.cta.primaryFg, fontSize: 15, fontFamily: FONT_FAMILY.bold, letterSpacing: 0.2 }}>{text}</Text>
    </Pressable>
  );
}

type Tone = "error" | "success" | "info";
type FeatherName = ComponentProps<typeof Feather>["name"];

const ICONS: Record<Tone, FeatherName> = { error: "alert-circle", success: "check-circle", info: "info" };

/**
 * Un message d'état dans la carte : icône + texte, jamais la couleur seule.
 * L'erreur est annoncée tout de suite (`assertive`), le reste poliment.
 */
export function AuthNotice({ tone, children, style }: { tone: Tone; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const pair = tone === "info" ? { bg: colors.fill.subtle, fg: colors.text.secondary } : colors.statusPairs[tone];
  const border = tone === "info" ? colors.border.subtle : colors.status[tone];

  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : "text"}
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
      style={[
        { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, borderColor: border, backgroundColor: pair.bg, paddingHorizontal: 14, paddingVertical: 12 },
        style,
      ]}
    >
      <Feather name={ICONS[tone]} size={17} color={pair.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {typeof children === "string" ? (
          <Text style={{ color: pair.fg, fontSize: 13, lineHeight: 19, fontFamily: FONT_FAMILY.medium }}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

/** Lien secondaire : 44 pt de cible, texte `brand.light` ou tertiaire. */
export function AuthLink({ label, onPress, prefix, accessibilityRole = "link", style }: {
  label: string;
  onPress: () => void;
  /** Texte neutre avant le lien (« Pas encore de compte ? »). */
  prefix?: string;
  accessibilityRole?: "link" | "button";
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const auth = useThemedStyles(makeAuthStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={prefix ? `${prefix} ${label}` : label}
      style={({ pressed }) => [{ minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, opacity: pressed ? 0.7 : 1 }, style]}
    >
      <Text style={{ color: colors.text.tertiary, fontSize: 13, fontFamily: FONT_FAMILY.regular, textAlign: "center" }}>
        {prefix ? `${prefix} ` : ""}
        <Text style={auth.link}>{label}</Text>
      </Text>
    </Pressable>
  );
}
