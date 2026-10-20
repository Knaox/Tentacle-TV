import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useWatchTogetherOrIdle, useWtChat } from "@tentacle-tv/api-client";
import { TABLET_MIN_WIDTH } from "@/theme";
import { WtReactionLayer } from "../chat/WtReactionLayer";
import { groupPanelLayout, typingLabelKey, waitingNotice } from "@tentacle-tv/shared";
import { WtNoticeLayer } from "../notices/WtNoticeLayer";
import { openWtSheet } from "../wtSheets";
import { WtGroupPanel, type WtGroupPanelTab } from "./WtGroupPanel";
import { WtGroupButton, WtWaitingChip } from "./WtPlayerBadges";

export interface WtPlayerChrome {
  /** Une séance est active sur CE titre. */
  active: boolean;
  open: boolean;
  close: () => void;
  /** Le bouton de la rangée d'outils (null hors séance). */
  button: ReactNode;
  /** Le panneau du groupe, posé par `WtPlayerFrame`. */
  panel: ReactNode;
  /** Ce qui se pose SUR la vidéo : attente, réactions, messages (null hors séance). */
  layers: ReactNode;
}

/**
 * L'habillage du lecteur en séance — tout ce que le Watch Together montre
 * dans le lecteur, rendu ici pour que `PlayerScreen` n'en porte que trois
 * points d'ancrage (le cadre, le bouton, les couches). Le chat n'est « lu »
 * (non-lus remis à zéro) que panneau ouvert sur son onglet.
 */
export function useWtPlayerChrome(itemId: string): WtPlayerChrome {
  const { t } = useTranslation("watchTogether");
  const { room, selfId } = useWatchTogetherOrIdle();
  const chat = useWtChat();
  const { width, height } = useWindowDimensions();
  const large = Math.min(width, height) >= TABLET_MIN_WIDTH;
  const active = !!room && room.itemId === itemId;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<WtGroupPanelTab>("group");

  const { setOpen: setChatOpen } = chat;
  useEffect(() => { setChatOpen(active && open && tab === "chat"); }, [active, open, tab, setChatOpen]);
  useEffect(() => { if (!active) setOpen(false); }, [active]);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    // Des messages en attente : le panneau s'ouvre sur le chat.
    if (!open && chat.state.unread > 0) setTab("chat");
    setOpen((v) => !v);
  }, [open, chat.state.unread]);

  // Sur téléphone en portrait, le panneau est lui-même une feuille : il se
  // referme, et la feuille du groupe lui succède une fois retiré (`wtSheets`).
  const sheetLayout = groupPanelLayout(width, height, TABLET_MIN_WIDTH) === "sheet";
  const openRoom = useCallback(() => {
    if (sheetLayout) setOpen(false);
    openWtSheet("room");
  }, [sheetLayout]);

  if (!active || !room) {
    return { active: false, open: false, close, button: null, panel: null, layers: null };
  }

  const wait = waitingNotice(room, selfId);
  // « X est en train d'écrire… » : dans le chat, et, chat replié, sur la vidéo.
  const typing = typingLabelKey(chat.state.typing);
  const typingText = typing ? t(typing.key, typing.params) : null;
  const chatVisible = open && tab === "chat";
  return {
    active,
    open,
    close,
    button: (
      <WtGroupButton memberCount={room.members.length} unread={chat.state.unread} active={open} onPress={toggle} large={large} />
    ),
    panel: (
      <WtGroupPanel
        tab={tab}
        onTab={setTab}
        room={room}
        selfId={selfId}
        unread={chat.state.unread}
        messages={chat.state.messages}
        onSend={chat.sendChat}
        onReact={chat.sendReaction}
        onSendGif={chat.sendGif}
        typingText={typingText}
        onTyping={chat.notifyTyping}
        onOpenRoom={openRoom}
        onClose={close}
      />
    ),
    layers: (
      <>
        {wait && <WtWaitingChip text={t(wait.key, wait.params)} />}
        <WtReactionLayer reactions={chat.state.reactions} />
        <WtNoticeLayer chatToasts={chatVisible ? [] : chat.state.toasts} typingText={chatVisible ? null : typingText} />
      </>
    ),
  };
}
