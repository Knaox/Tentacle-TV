import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SubtleBackground, IconButton } from "../ui";
import { BORDER, BRAND, CTA, FONT_FAMILY, RADIUS } from "../../theme";
import { Chip } from "./Chip";
import { CATEGORIES, useTicketApi, type Category } from "./ticketTypes";

interface Props {
  onBack: () => void;
  onCreated: (id: string) => void;
}

export function TicketComposerView({ onBack, onCreated }: Props) {
  const { t } = useTranslation("tickets");
  const { t: tc } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const { serverUrl, headers } = useTicketApi();
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [body, setBody] = useState("");

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${serverUrl}/api/tickets`, {
        method: "POST",
        headers,
        body: JSON.stringify({ subject: subject.trim(), category, body: body.trim() }),
      });
      if (!res.ok) throw new Error("create failed");
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      onCreated(d.id);
    },
  });

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !createMut.isPending;

  return (
    <SubtleBackground ambient>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 80,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 8 }}>
            <IconButton
              icon="chevron-left"
              onPress={onBack}
              size={40}
              bgColor="transparent"
              color={BRAND.light}
              accessibilityLabel="Back"
            />
            <Text
              style={{
                fontSize: 26,
                fontFamily: FONT_FAMILY.extrabold,
                fontWeight: "800",
                letterSpacing: -0.6,
                color: "#FFFFFF",
                flex: 1,
              }}
              accessibilityRole="header"
            >
              {t("newTicket")}
            </Text>
          </View>

          <Text style={sectionLabelStyle}>{t("subject")}</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            maxLength={300}
            placeholderTextColor="rgba(255,255,255,0.3)"
            placeholder={t("subjectPlaceholder")}
            accessibilityLabel={t("subject")}
            style={inputStyle}
          />

          <Text style={[sectionLabelStyle, { marginTop: 20 }]}>{t("category")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {CATEGORIES.map((c) => (
              <Chip
                key={c.value}
                label={t(c.tKey)}
                active={category === c.value}
                onPress={() => setCategory(c.value)}
              />
            ))}
          </ScrollView>

          <Text style={[sectionLabelStyle, { marginTop: 20 }]}>{t("message")}</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            maxLength={5000}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            placeholderTextColor="rgba(255,255,255,0.3)"
            placeholder={t("messagePlaceholder")}
            accessibilityLabel={t("message")}
            style={[inputStyle, { height: 160, paddingTop: 14 }]}
          />

          <Pressable
            onPress={() => createMut.mutate()}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={t("createTicket")}
            style={({ pressed }) => [
              {
                marginTop: 28,
                backgroundColor: CTA.primaryBg,
                borderRadius: RADIUS.md,
                paddingVertical: 13,
                minHeight: 46,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
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
            {createMut.isPending ? (
              <ActivityIndicator color={CTA.primaryFg} size="small" />
            ) : (
              <>
                <Feather name="send" size={14} color={CTA.primaryFg} />
                <Text style={{
                  color: CTA.primaryFg,
                  fontSize: 15,
                  fontFamily: FONT_FAMILY.bold,
                  letterSpacing: 0.2,
                }}>
                  {createMut.isPending ? tc("sending") : t("createTicket")}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SubtleBackground>
  );
}

const sectionLabelStyle = {
  fontSize: 12,
  fontFamily: FONT_FAMILY.bold,
  color: "rgba(255,255,255,0.85)",
  textTransform: "uppercase" as const,
  letterSpacing: 0.6,
  marginBottom: 8,
};

const inputStyle = {
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderColor: BORDER.subtle,
  borderRadius: RADIUS.md,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: "#FFFFFF",
  fontSize: 15,
  fontFamily: FONT_FAMILY.regular,
};
