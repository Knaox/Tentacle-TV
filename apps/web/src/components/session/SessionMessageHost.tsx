import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { onSessionMessage, type SessionMessage } from "@tentacle-tv/api-client";

/**
 * Les messages que l'administrateur envoie à cette session — depuis le tableau
 * de bord de Jellyfin (`DisplayMessage`) ou celui de Tentacle. Monté une fois,
 * au-dessus de tout : ils arrivent aussi en pleine lecture.
 *
 * ⚠️ Pas de flou, pas de dégradé, pas d'ombre : sur la coquille macOS, la vidéo
 * vit dans une AUTRE fenêtre, sous la nôtre, et toute couche à alpha composée
 * par-dessus y laisse un artefact. Une surface pleine et un liseré net
 * s'affichent à l'identique partout.
 *
 * Avec un délai, le message s'efface seul (borné à 3–60 s) ; sans délai, il
 * reste jusqu'à ce qu'on le ferme — comme l'alerte de Jellyfin : un message
 * d'administrateur qui disparaîtrait avant d'être lu ne servirait à rien.
 */

const MIN_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 60_000;
/** Au-delà, les plus anciens cèdent la place : l'écran reste lisible. */
const MAX_VISIBLE = 3;

interface Shown extends SessionMessage {
  id: number;
}

export function SessionMessageHost() {
  const [messages, setMessages] = useState<Shown[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.current.delete(id);
    setMessages((current) => current.filter((m) => m.id !== id));
  }, []);

  useEffect(() => {
    const pending = timers.current;
    const off = onSessionMessage((message) => {
      seq.current += 1;
      const id = seq.current;
      setMessages((current) => [...current, { ...message, id }].slice(-MAX_VISIBLE));
      if (message.timeoutMs !== undefined) {
        const delay = Math.min(Math.max(message.timeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
        pending.set(id, setTimeout(() => dismiss(id), delay));
      }
    });
    return () => {
      off();
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, [dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <MessageBanner key={message.id} message={message} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

const MessageBanner = memo(function MessageBanner({
  message,
  onDismiss,
}: {
  message: Shown;
  onDismiss: (id: number) => void;
}) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.div
      layout={!reduced}
      initial={{ opacity: 0, y: reduced ? 0 : -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -8, transition: { duration: 0.14 } }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="pointer-events-auto w-[min(28rem,100%)]"
    >
      <MessageBannerCard header={message.header} text={message.text} onDismiss={() => onDismiss(message.id)} />
    </motion.div>
  );
});

/**
 * Le bandeau lui-même, sans son mouvement — exporté pour l'écran de
 * nouveautés, dont la scène le montre tel quel.
 */
export function MessageBannerCard({ header, text, onDismiss }: { header: string; text: string; onDismiss?: () => void }) {
  const { t } = useTranslation("sessions");
  return (
    <div className="flex items-stretch gap-3 overflow-hidden rounded-xl border border-line-strong bg-surface-3 py-3 pl-3 pr-1 text-content-primary">
      <span aria-hidden className="w-1 shrink-0 rounded-full bg-brand" />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-xs font-medium text-content-tertiary">{t("messageFrom")}</p>
        {header && <p className="mt-0.5 break-words text-sm font-semibold">{header}</p>}
        <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-content-secondary">{text}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("dismissMessage")}
        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center self-start rounded-lg text-content-tertiary hover:bg-fill-soft hover:text-content-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-line-focus"
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
