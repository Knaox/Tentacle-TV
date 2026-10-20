import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SendHorizontal } from "lucide-react-native";
import type { GifItem } from "@tentacle-tv/api-client";
import { WT_CHAT_MAX_LENGTH, WT_QUICK_REACTIONS, type WtChatMessageDto } from "@tentacle-tv/shared";
import { FONT_FAMILY, PLAYER, RADIUS } from "@/theme";
import { KeyboardAvoidingArea } from "@/components/ui/KeyboardAvoidingArea";
import { haptic } from "@/utils/haptics";
import { WtEmojiPicker } from "./WtEmojiPicker";
import { WtGifPicker } from "./WtGifPicker";


/** Ce qui occupe le bas du panneau, sous le fil : réactions rapides, grille d'emojis ou GIF. */
type ChatTray = "quick" | "emoji" | "gif";

/**
 * Le chat du groupe, posé sur la vidéo — VRAIMENT interactif : on enchaîne
 * messages, réactions, emojis et GIF sans quitter le fil. Sous le fil, selon
 * le choix : les six réactions d'un toucher, la grille d'emojis du bureau
 * (`WtEmojiPicker`, qui reste ouverte pour une rafale) ou les GIF ; puis
 * « X est en train d'écrire… » et la saisie, toujours au-dessus du clavier.
 * Une seule vue pour la feuille du téléphone et la colonne de l'iPad ;
 * couleurs du lecteur (`PLAYER`). Pas d'écho local : un message s'affiche
 * quand le serveur le renvoie.
 */
export const WtChatPanel = memo(function WtChatPanel({ messages, selfId, onSend, onReact, onSendGif, typingText, onTyping }: {
  messages: readonly WtChatMessageDto[];
  selfId: string | null;
  /** Faux : le débit partagé a refusé l'envoi — le brouillon reste. */
  onSend: (text: string) => boolean;
  onReact: (emoji: string) => boolean;
  onSendGif: (gif: GifItem) => boolean;
  /** « X est en train d'écrire… », déjà dit en mots (null : personne). */
  typingText?: string | null;
  /** Une frappe : le crochet partagé en tire l'avis d'écriture (anti-rafale compris). */
  onTyping?: () => void;
}) {
  const { t } = useTranslation("watchTogether");
  const [draft, setDraft] = useState("");
  const [tray, setTray] = useState<ChatTray>("quick");
  // Liste inversée : le dernier message reste collé à la saisie.
  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    // Refusé par le débit partagé (rafale) : le brouillon reste, on réessaie.
    if (onSend(text.slice(0, WT_CHAT_MAX_LENGTH))) setDraft("");
  }, [draft, onSend]);

  const react = useCallback((emoji: string) => {
    if (onReact(emoji)) haptic("select");
  }, [onReact]);

  const type = useCallback((text: string) => {
    setDraft(text);
    if (text.trim() !== "") onTyping?.();
  }, [onTyping]);

  const toggle = (next: ChatTray) => () => setTray((cur) => (cur === next ? "quick" : next));

  return (
    // La saisie reste au-dessus du clavier (feuille, colonne de l'iPad, panneau en paysage).
    <KeyboardAvoidingArea style={st.panel}>
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
      {tray === "quick" && (
        <View style={st.reactions}>
          {WT_QUICK_REACTIONS.map((emoji) => (
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
      )}
      {tray === "emoji" && <WtEmojiPicker onPick={react} />}
      {tray === "gif" && (
        <View style={st.gifTray}>
          <WtGifPicker onSend={(gif) => { if (onSendGif(gif)) haptic("tap"); }} onClose={() => setTray("quick")} />
        </View>
      )}
      {typingText ? (
        <Text style={st.typing} numberOfLines={1} accessibilityLiveRegion="polite" testID="wt-chat-typing">{typingText}</Text>
      ) : null}
      <View style={st.inputRow}>
        <TrayToggle label="😀" a11y={t("pickerOpenEmojis")} active={tray === "emoji"} onPress={toggle("emoji")} testID="wt-chat-emoji" />
        <TrayToggle label="GIF" a11y={t("pickerOpenGifs")} active={tray === "gif"} onPress={toggle("gif")} testID="wt-chat-gif" />
        <TextInput
          value={draft}
          onChangeText={type}
          onFocus={() => setTray("quick")}
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
    </KeyboardAvoidingArea>
  );
});

function TrayToggle({ label, a11y, active, onPress, testID }: {
  label: string; a11y: string; active: boolean; onPress: () => void; testID: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ expanded: active }}
      style={({ pressed }) => [st.toggle, active && st.toggleActive, pressed && st.reactionPressed]} testID={testID}>
      <Text style={st.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

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
  inputRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8 },
  input: {
    flex: 1, minHeight: 44, paddingHorizontal: 14, borderRadius: RADIUS.pill, color: PLAYER.text, fontSize: 16,
    backgroundColor: PLAYER.fillSoft, fontFamily: FONT_FAMILY.regular,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: PLAYER.accent },
  sendDisabled: { opacity: 0.4 },
  toggle: { width: 40, height: 44, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: PLAYER.fillSoft },
  toggleActive: { backgroundColor: PLAYER.accent },
  toggleLabel: { color: PLAYER.text, fontSize: 13, fontFamily: FONT_FAMILY.bold },
  gifTray: { height: 300 },
  typing: { paddingHorizontal: 14, paddingTop: 4, color: PLAYER.textTertiary, fontSize: 13, fontStyle: "italic", fontFamily: FONT_FAMILY.regular },
});
