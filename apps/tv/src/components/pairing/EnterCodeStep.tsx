import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, TextInput, ActivityIndicator, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useRelayStatus } from "@tentacle-tv/api-client";
import type { RelayStatusResponse } from "@tentacle-tv/api-client";
import { Focusable } from "../focus/Focusable";
import { TentacleLogo } from "../icons/TentacleLogo";
import { Colors, Radius, Typography } from "../../theme/colors";

interface EnterCodeStepProps {
  onConfirmed: (data: RelayStatusResponse) => void;
  onBack: () => void;
}

/** Le code de provisionnement fait toujours 12 caractères (cf. backend
 *  `adminProvisioning.ts` : CODE_LENGTH = 12). Affiché en 3 groupes de 4. */
const CODE_LENGTH = 12;
const GROUP_SIZE = 4;
const GROUPS = CODE_LENGTH / GROUP_SIZE;
/** Alphabet du code (même jeu que le backend, sans O/I/0/1) → on filtre la saisie
 *  pour ignorer tout caractère parasite de la télécommande. */
const VALID_CHAR = /[A-Z0-9]/;

/** Normalise la saisie : majuscules, caractères valides uniquement, max 12. */
function clean(raw: string): string {
  return raw
    .toUpperCase()
    .split("")
    .filter((c) => VALID_CHAR.test(c))
    .join("")
    .slice(0, CODE_LENGTH);
}

/**
 * Saisie d'un code de jumelage de provisionnement (code 12 caractères géré
 * depuis l'admin web). Pensé pour les testeurs des stores TV : l'utilisateur
 * tape le code à la télécommande, les 12 caractères s'affichent en 3 groupes de
 * 4 avec un curseur visible, et la validation se déclenche automatiquement une
 * fois les 12 caractères saisis. La TV interroge le relay : si l'entrée
 * pré-confirmée existe, le jumelage est immédiat.
 */
export function EnterCodeStep({ onConfirmed, onBack }: EnterCodeStepProps) {
  const { t } = useTranslation(["pairing", "common"]);
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // Poll le relay une fois un code soumis (réutilise le hook du flux relais).
  const { data, isFetching } = useRelayStatus(submitted);

  useEffect(() => {
    if (!submitted || !data) return;
    if (data.status === "confirmed" && data.serverUrl && data.token && data.user) {
      onConfirmed(data);
    } else if (data.status === "expired") {
      setError(t("pairing:codeInvalid"));
      setSubmitted(null);
    }
  }, [data, submitted, onConfirmed, t]);

  const submit = useCallback((code: string) => {
    if (code.length !== CODE_LENGTH) return;
    setError(null);
    setSubmitted(code);
  }, []);

  const onChangeText = useCallback(
    (text: string) => {
      const next = clean(text);
      setValue(next);
      setError(null);
      // Auto-validation : dès que les 12 caractères sont saisis, on lance la
      // vérification sans attendre un appui supplémentaire (UX télécommande).
      if (next.length === CODE_LENGTH) submit(next);
    },
    [submit],
  );

  const checking = !!submitted && (isFetching || data?.status === "pending");
  const complete = value.length === CODE_LENGTH;

  // Index du curseur (prochaine case à remplir), visible uniquement au focus.
  const cursor = focused && !checking ? value.length : -1;
  const groups = useMemo(
    () => Array.from({ length: GROUPS }, (_, g) => g * GROUP_SIZE),
    [],
  );

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TentacleLogo size={56} />
        <Text style={styles.title}>{t("pairing:enterProvisioningTitle")}</Text>
        <Text style={styles.subtitle}>{t("pairing:enterProvisioningSubtitle")}</Text>

        {/* Zone de saisie : les cases sont l'affichage ; un TextInput transparent
            superposé capte la frappe. Pressable (et non Focusable) pour éviter le
            calque de surbrillance plein qui recouvrait toutes les cases. */}
        <Pressable
          onPress={() => inputRef.current?.focus()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          hasTVPreferredFocus
          accessibilityLabel={t("pairing:enterProvisioningTitle")}
        >
          <View style={[styles.slotsArea, focused && styles.slotsAreaFocused]}>
            {groups.map((start, gi) => (
              <View key={start} style={styles.group}>
                {gi > 0 && <Text style={styles.groupSep}>–</Text>}
                <View style={styles.groupSlots}>
                  {Array.from({ length: GROUP_SIZE }, (_, j) => {
                    const idx = start + j;
                    const char = value[idx] ?? "";
                    const active = idx === cursor;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.slot,
                          char !== "" && styles.slotFilled,
                          active && styles.slotActive,
                        ]}
                      >
                        <Text style={styles.slotChar}>{char || (active ? "|" : "")}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              onSubmitEditing={() => submit(value)}
              maxLength={CODE_LENGTH + 4}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="done"
              caretHidden
              editable={!checking}
              style={styles.hiddenInput}
            />
          </View>
        </Pressable>

        <Text style={styles.counter}>
          {t("pairing:codeProgress", { count: value.length, total: CODE_LENGTH })}
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Focusable variant="button" onPress={() => submit(value)}>
            <View style={[styles.buttonPrimary, (checking || !complete) && styles.buttonDisabled]}>
              {checking ? (
                <ActivityIndicator color={Colors.ctaPrimaryFg} />
              ) : (
                <Text style={styles.buttonPrimaryText}>{t("pairing:validateCode")}</Text>
              )}
            </View>
          </Focusable>
          {value.length > 0 && !checking && (
            <Focusable
              variant="button"
              onPress={() => { setValue(""); setError(null); inputRef.current?.focus(); }}
              accessibilityLabel={t("pairing:clearCode")}
            >
              <View style={styles.buttonGhost}>
                <Text style={styles.buttonGhostText}>{t("pairing:clearCode")}</Text>
              </View>
            </Focusable>
          )}
          <Focusable variant="button" onPress={onBack} accessibilityLabel={t("common:back")}>
            <View style={styles.buttonGhost}>
              <Text style={styles.buttonGhostText}>{t("common:back")}</Text>
            </View>
          </Focusable>
        </View>

        <Text style={styles.hint}>{t("pairing:enterCodeRemoteHint")}</Text>
      </View>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: Colors.bgDeep,
  },
  card: {
    width: 620,
    padding: 44,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.buttonLarge,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: "center" as const,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: "700" as const,
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    textAlign: "center" as const,
    lineHeight: 22,
    marginBottom: 28,
  },
  slotsArea: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    position: "relative" as const,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  // Bague de focus autour du groupe entier (pas de remplissage plein).
  slotsAreaFocused: {
    borderColor: Colors.focusBorder,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  group: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  groupSep: {
    color: Colors.textTertiary,
    fontSize: 22,
    marginHorizontal: 8,
  },
  groupSlots: {
    flexDirection: "row" as const,
    gap: 6,
  },
  slot: {
    width: 32,
    height: 46,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  slotFilled: {
    borderColor: Colors.glassBorder,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  slotActive: {
    borderColor: Colors.ctaPrimaryBg,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  slotChar: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: "700" as const,
  },
  // TextInput transparent superposé : capte la frappe, invisible à l'écran.
  hiddenInput: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: "transparent",
  },
  counter: {
    color: Colors.textTertiary,
    fontSize: 14,
    marginTop: 14,
    fontVariant: ["tabular-nums" as const],
  },
  errorBox: {
    marginTop: 16,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: "center" as const,
  },
  actions: {
    marginTop: 24,
    width: "100%" as const,
    gap: 12,
  },
  buttonPrimary: {
    backgroundColor: Colors.ctaPrimaryBg,
    borderRadius: Radius.buttonLarge,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  buttonPrimaryText: {
    color: Colors.ctaPrimaryFg,
    ...Typography.buttonLarge,
  },
  buttonGhost: {
    backgroundColor: Colors.ctaGhostBg,
    borderWidth: 1,
    borderColor: Colors.ctaGhostBorder,
    borderRadius: Radius.buttonLarge,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center" as const,
  },
  buttonGhostText: {
    color: Colors.textPrimary,
    ...Typography.buttonLarge,
  },
  buttonDisabled: { opacity: 0.4 },
  hint: {
    color: Colors.textTertiary,
    fontSize: 13,
    textAlign: "center" as const,
    marginTop: 24,
  },
};
