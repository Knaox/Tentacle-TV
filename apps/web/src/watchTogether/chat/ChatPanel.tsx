import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { typingLabelKey } from "@tentacle-tv/shared";
import type { WtChatApi } from "@tentacle-tv/api-client";
import { useWatchTogether } from "../WatchTogetherProvider";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";
import { ReactionPicker, type PickerTab } from "./picker/ReactionPicker";
import "./chat.css";
import "./chatThread.css";

/** Durée d'affichage de « Doucement… » quand le débit refuse un envoi. */
const REFUSED_HINT_MS = 1800;

/**
 * La ligne sous le fil : « X est en train d'écrire… » (les autres, jamais soi), ou l'avis que
 * le débit vient de refuser un envoi. Sa place est RÉSERVÉE : elle paraît sans rien pousser.
 */
function StatusLine({ typing, refused }: { typing: WtChatApi["state"]["typing"]; refused: boolean }) {
  const { t } = useTranslation("watchTogether");
  const label = typingLabelKey(typing);
  if (refused) {
    return <p className="wtc-typing" data-tone="hint" role="status"><span className="wtc-typing__label">{t("chatSlowDown")}</span></p>;
  }
  return (
    <p className="wtc-typing" aria-live="polite">
      {label && (
        <>
          <span className="wtc-dots" aria-hidden><i /><i /><i /></span>
          <span className="wtc-typing__label">{t(label.key, label.params)}</span>
        </>
      )}
    </p>
  );
}

interface ChatPanelProps {
  chat: WtChatApi;
  /** Le premier message non lu à l'ouverture (relevé par la bulle avant d'ouvrir). */
  unreadFromId?: string | null;
}

/**
 * Watch Together — le corps du panneau de chat : le fil (`ChatMessages`), la ligne d'état, le
 * sélecteur d'emojis et de GIF posé sur le bas du fil, puis la saisie (`ChatComposer`).
 *
 * Sa peau est dans `chat.css` : une encre fixe sur la vidéo, les jetons du thème ailleurs.
 */
export function ChatPanel({ chat, unreadFromId = null }: ChatPanelProps) {
  const { selfId } = useWatchTogether();
  const [pickerTab, setPickerTab] = useState<PickerTab | null>(null);
  const [refused, setRefused] = useState(false);
  const refusedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onRefused = useCallback(() => {
    setRefused(true);
    if (refusedTimer.current !== null) clearTimeout(refusedTimer.current);
    refusedTimer.current = setTimeout(() => {
      refusedTimer.current = null;
      setRefused(false);
    }, REFUSED_HINT_MS);
  }, []);

  useEffect(() => () => {
    if (refusedTimer.current !== null) clearTimeout(refusedTimer.current);
  }, []);

  const closePicker = useCallback(() => setPickerTab(null), []);

  return (
    <>
      <div className="wtc-thread" data-picker={pickerTab !== null}>
        <ChatMessages messages={chat.state.messages} selfId={selfId} unreadFromId={unreadFromId} pickerOpen={pickerTab !== null} />
        <StatusLine typing={chat.state.typing} refused={refused} />
        <ReactionPicker tab={pickerTab} onTabChange={setPickerTab} onClose={closePicker} chat={chat} onRefused={onRefused} />
      </div>
      <ChatComposer chat={chat} pickerTab={pickerTab} onPickerTab={setPickerTab} onRefused={onRefused} />
    </>
  );
}
