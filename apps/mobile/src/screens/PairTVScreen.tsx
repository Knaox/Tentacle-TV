import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import {
  useGenerateTvToken,
  useRelayConfirm,
  useTentacleConfig,
} from "@tentacle-tv/api-client";
import {
  BRAND,
  CTA,
  FONT_FAMILY,
  RADIUS,
  STATUS,
} from "../theme";
import { SubtleBackground, GlassCard, FadeIn, IconButton } from "../components/ui";
import { PairCodeInputs, type PairCodeInputsHandle } from "../components/pair/PairCodeInputs";

export function PairTVScreen() {
  const { t } = useTranslation("pairing");
  const { t: te } = useTranslation("errors");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { storage } = useTentacleConfig();
  const tvTokenMut = useGenerateTvToken();
  const relayConfirmMut = useRelayConfirm();

  const [chars, setChars] = useState(["", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "pairing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const codeInputsRef = useRef<PairCodeInputsHandle>(null);

  const code = chars.join("");
  const canSubmit = code.length === 4 && status === "idle";

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setStatus("pairing");
    setErrorMsg("");

    try {
      const { token } = await tvTokenMut.mutateAsync();

      const serverUrl = storage.getItem("tentacle_server_url") ?? "";
      if (!serverUrl) throw new Error(te("noServerUrl"));

      const userRaw = storage.getItem("tentacle_user");
      const user = userRaw ? JSON.parse(userRaw) as { Id: string; Name: string } : null;
      if (!user?.Id || !user?.Name) throw new Error(te("userInfoNotFound"));

      await relayConfirmMut.mutateAsync({
        code,
        serverUrl,
        token,
        user: { id: user.Id, name: user.Name },
      });

      setStatus("success");
    } catch (err) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") || msg.includes("invalide") || msg.includes("expire")) {
        setErrorMsg(t("codeInvalid"));
      } else if (msg.includes("409") || msg.includes("utilise")) {
        setErrorMsg(t("codeInvalid"));
      } else {
        setErrorMsg(t("relayError"));
      }
    }
  }, [canSubmit, code, tvTokenMut, relayConfirmMut, storage, t, te]);

  const handleReset = useCallback(() => {
    setChars(["", "", "", ""]);
    setStatus("idle");
    setErrorMsg("");
    codeInputsRef.current?.focusFirst();
  }, []);

  return (
    <SubtleBackground ambient>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
          marginBottom: 8,
        }}>
          <IconButton
            icon="chevron-left"
            onPress={() => router.back()}
            size={40}
            bgColor="transparent"
            color={BRAND.light}
            accessibilityLabel="Back"
          />
        </View>

        <FadeIn delay={0} translateY={10} style={{ alignItems: "center", marginTop: 8, marginBottom: 16 }}>
          <View style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: BRAND.soft,
            borderWidth: 1,
            borderColor: "rgba(139,92,246,0.4)",
            justifyContent: "center",
            alignItems: "center",
            shadowColor: BRAND.violet,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 20,
            elevation: 10,
          }}>
            <Feather name="tv" size={48} color={BRAND.light} />
          </View>
        </FadeIn>

        <FadeIn delay={80} translateY={10}>
          <Text style={{
            fontSize: 28,
            fontFamily: FONT_FAMILY.extrabold,
            fontWeight: "800",
            color: "#FFFFFF",
            letterSpacing: -0.6,
            textAlign: "center",
            marginBottom: 6,
          }} accessibilityRole="header">
            {t("pairYourTV")}
          </Text>
          <Text style={{
            fontSize: 14,
            fontFamily: FONT_FAMILY.medium,
            color: BRAND.light,
            letterSpacing: 0.3,
            textAlign: "center",
            marginBottom: 24,
            paddingHorizontal: 32,
          }}>
            {t("enterTVCode")}
          </Text>
        </FadeIn>

        <FadeIn delay={140} translateY={12} style={{ paddingHorizontal: 16 }}>
          <GlassCard style={{ padding: 24 }}>
            {status === "success" ? (
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <View style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: "rgba(16,185,129,0.15)",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 14,
                }}>
                  <Feather name="check-circle" size={40} color={STATUS.success} />
                </View>
                <Text style={{
                  color: STATUS.success,
                  fontSize: 16,
                  fontFamily: FONT_FAMILY.semibold,
                  textAlign: "center",
                }}>
                  {t("tvPairedSuccess")}
                </Text>
              </View>
            ) : (
              <>
                <PairCodeInputs
                  ref={codeInputsRef}
                  chars={chars}
                  onChange={setChars}
                  status={status}
                />

                {status === "error" && errorMsg ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }}>
                    <Feather name="alert-circle" size={16} color={STATUS.error} />
                    <Text style={{
                      color: STATUS.error,
                      fontSize: 13,
                      fontFamily: FONT_FAMILY.medium,
                      textAlign: "center",
                    }}>{errorMsg}</Text>
                  </View>
                ) : null}

                {status === "error" ? (
                  <Pressable
                    onPress={handleReset}
                    accessibilityRole="button"
                    accessibilityLabel={t("retry")}
                    style={({ pressed }) => [
                      {
                        backgroundColor: BRAND.ghost,
                        borderWidth: 1,
                        borderColor: "rgba(139,92,246,0.4)",
                        borderRadius: RADIUS.md,
                        paddingVertical: 13,
                        minHeight: 46,
                        alignItems: "center",
                        justifyContent: "center",
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={{
                      color: "#FFFFFF",
                      fontSize: 15,
                      fontFamily: FONT_FAMILY.semibold,
                    }}>{t("retry")}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    accessibilityRole="button"
                    accessibilityLabel={t("pairTV")}
                    style={({ pressed }) => [
                      {
                        backgroundColor: CTA.primaryBg,
                        borderRadius: RADIUS.md,
                        paddingVertical: 13,
                        minHeight: 46,
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: BRAND.violet,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.55,
                        shadowRadius: 22,
                        elevation: 12,
                      },
                      !canSubmit && { opacity: 0.45, shadowOpacity: 0 },
                      canSubmit && pressed && { opacity: 0.88 },
                    ]}
                  >
                    {status === "pairing" ? (
                      <ActivityIndicator color={CTA.primaryFg} size="small" />
                    ) : (
                      <Text style={{
                        color: CTA.primaryFg,
                        fontSize: 15,
                        fontFamily: FONT_FAMILY.bold,
                        letterSpacing: 0.2,
                      }}>{t("pairTV")}</Text>
                    )}
                  </Pressable>
                )}
              </>
            )}
          </GlassCard>
        </FadeIn>

        <FadeIn delay={200} translateY={8}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 16,
            paddingHorizontal: 16,
          }}>
            <Feather name="clock" size={12} color="rgba(255,255,255,0.4)" />
            <Text style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
              fontFamily: FONT_FAMILY.regular,
              textAlign: "center",
            }}>
              {t("codeExpireNote")}
            </Text>
          </View>
        </FadeIn>
      </ScrollView>
    </SubtleBackground>
  );
}
