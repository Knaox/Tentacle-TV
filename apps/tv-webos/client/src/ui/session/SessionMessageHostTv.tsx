import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { onSessionMessage, type SessionMessage } from "@tentacle-tv/api-client";
import { useMessageCountdown } from "@/components/session/useMessageCountdown";

/**
 * Les messages que l'administrateur envoie à ce téléviseur — depuis le tableau
 * de bord de Jellyfin (`DisplayMessage`) ou celui de Tentacle. Substitué à
 * `components/session/SessionMessageHost.tsx`, monté une fois par `App.tsx` :
 * ils arrivent aussi en pleine lecture.
 *
 * Différence avec le web : RIEN ne se ferme d'un geste. Un bandeau focalisable
 * volerait le focus à ce qu'on regarde — le film, la rangée —, et la croix du
 * web ne se viserait qu'au prix d'un détour. Un message s'efface donc TOUJOURS
 * seul : son délai s'il en a un (borné à 3–60 s), sinon quinze secondes, et
 * une barre qui se vide le dit. Deux au plus : les plus anciens cèdent. C'est
 * le contrat de `TVSessionMessageHost` sur l'Apple TV et Android TV.
 *
 * Le décompte est celui du web (`useMessageCountdown`) : il se suspend quand
 * l'application passe en arrière-plan, pour qu'un message ne s'efface pas
 * pendant que l'écran montre autre chose.
 */

const MIN_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_VISIBLE = 2;

interface Shown extends SessionMessage {
  id: number;
  durationMs: number;
}

export function SessionMessageHost() {
  const { t } = useTranslation("sessions");
  const [messages, setMessages] = useState<Shown[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  useEffect(() => onSessionMessage((message) => {
    seq.current += 1;
    const durationMs = message.timeoutMs === undefined
      ? DEFAULT_TIMEOUT_MS
      : Math.min(Math.max(message.timeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
    setMessages((current) => [...current, { ...message, id: seq.current, durationMs }].slice(-MAX_VISIBLE));
  }), []);

  return (
    // Toujours monté : une région `aria-live` doit exister AVANT ce qu'elle annonce.
    <div className="tv-session-messages" role="status" aria-live="polite">
      {messages.map((message) => (
        <MessageBanner key={message.id} message={message} label={t("messageFrom")} onDone={dismiss} />
      ))}
    </div>
  );
}

const MessageBanner = memo(function MessageBanner({ message, label, onDone }: {
  message: Shown;
  label: string;
  onDone: (id: number) => void;
}) {
  const { id, durationMs } = message;
  const done = useCallback(() => onDone(id), [id, onDone]);
  const countdown = useMessageCountdown(durationMs, false, done);
  const running = countdown?.running ?? true;

  return (
    <div className="tv-session-message">
      <p className="tv-session-message-label">{label}</p>
      {message.header && <p className="tv-session-message-header">{message.header}</p>}
      {message.text && <p className="tv-session-message-text">{message.text}</p>}
      {/* `transform` seulement : la barre se vide sans rien repeindre, et se
          suspend avec le décompte quand l'application passe derrière. */}
      <span className="tv-session-message-track" aria-hidden>
        <span
          className="tv-session-message-bar"
          style={{ animationDuration: `${durationMs}ms`, animationPlayState: running ? "running" : "paused" }}
        />
      </span>
    </div>
  );
});

// L'aperçu du bandeau tel que le web le dessine : l'écran de nouveautés le
// montre dans une de ses scènes, et il n'a pas de raison d'y changer.
export { MessageBannerCard } from "@/components/session/SessionMessageHost?original";
