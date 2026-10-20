import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SendHorizontal } from "lucide-react-native";
import type { GifItem } from "@tentacle-tv/api-client";
import { WT_CHAT_MAX_LENGTH, type WtChatMessageDto } from "@tentacle-tv/shared";
import { FONT_FAMILY, PLAYER, RADIUS } from "@/theme";
import { haptic } from "@/utils/haptics";
import { WtGifPicker } from "./WtGifPicker";

/** Les réactions d'un toucher — les mêmes que le panneau du web (`ChatPanel`). */
export const QUICK_REACTIONS = ["😂", "❤️", "🔥", "😮", "👍", "😭"] as const;

/**
 * Le chat du groupe, posé sur la vidéo : le fil (le plus récent en bas), les
 * réactions d'un toucher, la saisie. Une seule vue pour la feuille du
 * téléphone et la colonne de l'iPad. Couleurs du lecteur (`PLAYER`) : texte
 * clair sur fond sombre quel que soit le thème, comme les contrôles.
 * Pas d'écho local : le message s'affiche quand le serveur le renvoie.
 * Au-delà des six réactions, le clavier du système donne ses emojis ; les
 * GIF passent par leur sélecteur (`WtGifPicker`), qui prend la place du fil.
 */
export const WtChatPanel = memo(function WtChatPanel({ messages, selfId, onSend, onReact, onSendGif }: {
  messages: readonly WtChatMessageDto[];
  selfId: string | null;
  onSend: (text: string) => void;
  onReact: (emoji: string) => void;
  onSendGif: (gif: GifItem) => void;
}) {
  const { t } = useTranslation("watchTogether");
  const [draft, setDraft] = useState("");
  const [gifOpen, setGifOpen] = useState(false);
  // Liste inversée : le dernier message reste collé à la saisie.
  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    onSend(text.slice(0, WT_CHAT_MAX_LENGTH));
    setDraft("");
  }, [draft, onSend]);

  const react = useCallback((emoji: string) => {
    haptic("select");
    onReact(emoji);
  }, [onReact]);

  if (gifOpen) {
    return (
      <View style={st.panel}>
        <WtGifPicker onSend={(gif) => { haptic("tap"); onSendGif(gif); setGifOpen(false); }} onClose={() => setGifOpen(false)} />
      </View>
    );
  }

  return (
    <View style={st.panel} testID="wt-chat">
      <FlatList
        data={reversed}
        inverted
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <ChatLine message={item} self={item.userId === selfId} />}
        contentContainerStyle={st.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={st.empty}>{t("chatEmpty")}</Text>}
      />
      <View style={st.reactions}>
        {QUICK_REACTIONS.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => react(emoji)}
            accessibilityRole="button"
            accessibilityLabel={emoji}
            style={({ pressed }) => [st.reaction, pressed && st.reactionPressed]}
            testID={`wt-react-${emoji}`}
          >
            <Text style={st.reactionText}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
      <View style={st.inputRow}>
        <Pressable onPress={() => setGifOpen(true)} accessibilityRole="button" accessibilityLabel={t("pickerOpenGifs")}
          style={({ pressed }) => [st.gif, pressed && st.reactionPressed]} testID="wt-chat-gif">
          <Text style={st.gifLabel}>GIF</Text>
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t("chatPlaceholder")}
          placeholderTextColor={PLAYER.textTertiary}
          maxLength={WT_CHAT_MAX_LENGTH}
          onSubmitEditing={send}
          returnKeyType="send"
          blurOnSubmit={false}
          style={st.input}
          accessibilityLabel={t("chatPlaceholder")}
          testID="wt-chat-input"
        />
        <Pressable
          onPress={send}
          disabled={draft.trim() === ""}
          accessibilityRole="button"
          accessibilityLabel={t("chatSend")}
          style={({ pressed }) => [st.send, draft.trim() === "" && st.sendDisabled, pressed && st.reactionPressed]}
          testID="wt-chat-send"
        >
          <SendHorizontal size={20} color={PLAYER.text} />
        </Pressable>
      </View>
    </View>
  );
});

const ChatLine = memo(function ChatLine({ message, self }: { message: WtChatMessageDto; self: boolean }) {
  return (
    <View style={[st.line, self && st.lineSelf]}>
      {!self && <Text style={st.author} numberOfLines={1}>{message.username}</Text>}
      <Text style={st.text}>{message.text}</Text>
    </View>
  );
});

const st = StyleSheet.create({
  panel: { flex: 1, minHeight: 0 },
  list: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  empty: { color: PLAYER.textTertiary, fontSize: 14, textAlign: "center", paddingVertical: 24, fontFamily: FONT_FAMILY.regular },
  line: {
    alignSelf: "flex-start", maxWidth: "85%", paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: RADIUS.xl, backgroundColor: PLAYER.fillSoft,
  },
  lineSelf: { alignSelf: "flex-end", backgroundColor: PLAYER.accent },
  author: { color: PLAYER.textTertiary, fontSize: 12, marginBottom: 2, fontFamily: FONT_FAMILY.semibold },
  text: { color: PLAYER.text, fontSize: 15, lineHeight: 20, fontFamily: FONT_FAMILY.regular },
  reactions: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 4 },
  reaction: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  reactionPressed: { opacity: 0.6, transform: [{ scale: 0.92 }] },
  reactionText: { fontSize: 24 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8 },
  input: {
    flex: 1, minHeight: 44, paddingHorizontal: 14, borderRadius: RADIUS.pill, color: PLAYER.text, fontSize: 16,
    backgroundColor: PLAYER.fillSoft, fontFamily: FONT_FAMILY.regular,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: PLAYER.accent },
  sendDisabled: { opacity: 0.4 },
  gif: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: PLAYER.fillSoft },
  gifLabel: { color: PLAYER.text, fontSize: 13, fontFamily: FONT_FAMILY.bold },
});
