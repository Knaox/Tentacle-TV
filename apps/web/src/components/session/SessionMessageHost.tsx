import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pause, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { onSessionMessage, type SessionMessage } from "@tentacle-tv/api-client";
import { useMessageCountdown, type MessageCountdown } from "./useMessageCountdown";

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
 * Avec un délai, le message s'efface seul (borné à 3–60 s) — et le DIT : un
 * compte à rebours (« Disparaît dans 8 s ») et une barre qui se vide, tous
 * deux suspendus au survol, au focus et fenêtre cachée (`useMessageCountdown`).
 * Sans délai, il reste jusqu'à ce qu'on le ferme — comme l'alerte de Jellyfin :
 * un message d'administrateur qui disparaîtrait avant d'être lu ne servirait
 * à rien.
 */

const MIN_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 60_000;
/** Au-delà, les plus anciens cèdent la place : l'écran reste lisible. */
const MAX_VISIBLE = 3;

interface Shown extends SessionMessage {
  id: number;
  /** Le délai d'affichage, borné — `null` : jusqu'à ce qu'on le ferme. */
  durationMs: number | null;
}

export function SessionMessageHost() {
  const [messages, setMessages] = useState<Shown[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((m) => m.id !== id));
  }, []);

  useEffect(() => onSessionMessage((message) => {
    seq.current += 1;
    const id = seq.current;
    const durationMs = message.timeoutMs === undefined
      ? null
      : Math.min(Math.max(message.timeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
    setMessages((current) => [...current, { ...message, id, durationMs }].slice(-MAX_VISIBLE));
  }), []);

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
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { id } = message;
  const countdown = useMessageCountdown(message.durationMs, hovered || focused, () => onDismiss(id));
  return (
    <motion.div
      layout={!reduced}
      initial={{ opacity: 0, y: reduced ? 0 : -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -8, transition: { duration: 0.14 } }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="pointer-events-auto w-[min(28rem,100%)]"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <MessageBannerCard
        header={message.header}
        text={message.text}
        durationMs={message.durationMs}
        countdown={countdown}
        onDismiss={() => onDismiss(id)}
      />
    </motion.div>
  );
});

/**
 * Le bandeau lui-même, sans son mouvement — exporté pour l'écran de
 * nouveautés, dont la scène le montre tel quel, et pour l'aperçu de la
 * rédaction (tableau de bord).
 *
 * Message temporaire : les secondes restantes dans l'en-tête, et une barre au
 * pied qui se vide. Couleurs PLEINES pour la barre et son rail (`surface-2`,
 * `brand`) : aucune couche à alpha au-dessus de la vidéo macOS.
 */
export function MessageBannerCard({ header, text, onDismiss, durationMs = null, countdown = null, still = false }: {
  header: string;
  text: string;
  onDismiss?: () => void;
  durationMs?: number | null;
  countdown?: MessageCountdown | null;
  /** Aperçu : le compte à rebours s'affiche à son départ, sans s'écouler. */
  still?: boolean;
}) {
  const { t } = useTranslation("sessions");
  return (
    <div className="relative flex items-stretch gap-3 overflow-hidden rounded-xl border border-line-strong bg-surface-3 py-3 pl-3 pr-1 text-content-primary">
      <span aria-hidden className="w-1 shrink-0 rounded-full bg-brand" />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="flex h-4 items-center justify-between gap-3 text-xs font-medium leading-4 text-content-tertiary">
          <span className="truncate">{t("messageFrom")}</span>
          {countdown !== null && (
            <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-content-secondary">
              {!countdown.running && !still && <Pause size={11} aria-hidden />}
              {t(countdown.running || still ? "vanishesIn" : "vanishHeld", { count: countdown.secondsLeft })}
            </span>
          )}
        </p>
        {header && <p className="mt-0.5 break-words text-sm font-semibold">{header}</p>}
        <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-content-secondary">{text}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("dismissMessage")}
          className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center self-start rounded-lg text-content-tertiary hover:bg-fill-soft hover:text-content-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-line-focus"
        >
          <X size={18} aria-hidden />
        </button>
      ) : (
        // Aperçu et scène de nouveautés : la croix se voit, elle ne se focalise pas.
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center self-start text-content-tertiary">
          <X size={18} />
        </span>
      )}
      {durationMs !== null && countdown !== null && (
        // Mouvement réduit : la barre se viderait d'un coup (animations
        // ramenées à 0,01 ms) — le compte à rebours écrit suffit.
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-surface-2 motion-reduce:hidden">
          <span
            className="block h-full origin-left animate-countdown bg-brand"
            style={{ animationDuration: `${durationMs}ms`, animationPlayState: countdown.running && !still ? "running" : "paused" }}
          />
        </span>
      )}
    </div>
  );
}
