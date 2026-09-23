import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, LoaderCircle, Send } from "lucide-react";
import { Modal } from "../../ui/Modal";
import { ModalHeader } from "../../ui/ModalHeader";
import { MessageBannerCard } from "../../session/SessionMessageHost";
import { isAppleKeyboard } from "../../../lib/shortcutLabel";
import { cls } from "../../../pages/adminUtils";
import type { MessageInput } from "../../../hooks/useAdminSessions";
import { ActionPill } from "./ActionPill";

/**
 * La rédaction d'un message à une session — ou à tout un groupe Watch
 * Together.
 *
 * - Le destinataire est sous le titre : on sait à QUI et sur QUEL appareil
 *   on écrit.
 * - La durée se choisit d'un geste (pastilles), plus dans une liste.
 * - L'APERÇU montre le bandeau tel que la personne le verra, compte à rebours
 *   compris quand le message est temporaire.
 * - ⌘↵ (Ctrl+↵) envoie ; un échec s'affiche ici, le texte n'est pas perdu.
 *
 * Par défaut, « jusqu'à ce qu'il soit fermé » : un message d'administrateur
 * est fait pour être lu.
 */

const TEXT_MAX = 1_000;
const HEADER_MAX = 100;
const DURATIONS = [
  { value: null, key: "durationUntilClosed" },
  { value: 10_000, key: "duration10" },
  { value: 30_000, key: "duration30" },
  { value: 60_000, key: "duration60" },
] as const;

type Duration = (typeof DURATIONS)[number]["value"];

function DurationPicker({ value, onChange }: { value: Duration; onChange: (value: Duration) => void }) {
  const { t } = useTranslation("sessions");
  const name = useId();
  return (
    <fieldset>
      <legend className={cls.lbl}>{t("composerDuration")}</legend>
      <div className="flex flex-wrap gap-2">
        {DURATIONS.map((d) => (
          <label key={d.key} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              className="peer sr-only"
              checked={value === d.value}
              onChange={() => onChange(d.value)}
            />
            <span className="inline-flex h-9 items-center rounded-full border border-line-subtle bg-fill-subtle px-3.5 text-[13px] font-medium text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary peer-checked:border-[color:rgba(var(--brand-rgb),0.5)] peer-checked:bg-[rgba(var(--brand-rgb),0.18)] peer-checked:text-content-primary peer-focus-visible:ring-2 peer-focus-visible:ring-line-focus">
              {t(d.key)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function MessageComposer({
  title,
  recipient,
  previewName,
  pending,
  failed,
  onSend,
  onClose,
}: {
  /** Déjà traduit : « Message à Alice », « Message au groupe ». */
  title: string;
  /** Qui, et où : l'avatar, le nom, l'appareil — ou les membres d'une salle. */
  recipient: ReactNode;
  /** Pour la légende de l'aperçu : « Ce que verra Alice ». */
  previewName: string | null;
  pending: boolean;
  failed: boolean;
  onSend: (input: MessageInput) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("sessions");
  const titleId = useId();
  const headerId = useId();
  const textId = useId();
  const [header, setHeader] = useState("");
  const [text, setText] = useState("");
  const [duration, setDuration] = useState<Duration>(null);
  const empty = text.trim().length === 0;
  const ready = !empty && !pending;
  const shortcut = isAppleKeyboard() ? "⌘ ↵" : "Ctrl ↵";

  const submit = () => {
    if (!ready) return;
    onSend({ header: header.trim(), text: text.trim(), ...(duration === null ? {} : { timeoutMs: duration }) });
  };

  const onTextKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <Modal open onClose={onClose} labelledBy={titleId} maxWidth={560}>
      <ModalHeader title={title} titleId={titleId} subtitle={recipient} onClose={onClose} />
      <form
        className="space-y-4 px-6 pb-6 pt-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div>
          <label htmlFor={headerId} className={cls.lbl}>{t("composerHeader")}</label>
          <input
            id={headerId}
            className={cls.inp}
            value={header}
            maxLength={HEADER_MAX}
            onChange={(event) => setHeader(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor={textId} className={cls.lbl}>{t("composerText")}</label>
          <textarea
            id={textId}
            required
            rows={3}
            maxLength={TEXT_MAX}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onTextKey}
            className={`${cls.inp} h-auto resize-y py-2 leading-relaxed`}
          />
          <p className="mt-1 text-right text-xs tabular-nums text-content-quaternary">{text.length} / {TEXT_MAX}</p>
        </div>

        <DurationPicker value={duration} onChange={setDuration} />

        <div>
          <p className={cls.lbl}>{previewName ? t("composerPreviewFor", { name: previewName }) : t("composerPreview")}</p>
          <div className={empty ? "opacity-60" : undefined}>
            <MessageBannerCard
              header={header.trim()}
              text={text.trim() || t("composerPreviewEmpty")}
              durationMs={duration}
              countdown={duration === null ? null : { secondsLeft: duration / 1000, running: true }}
              still
            />
          </div>
        </div>

        {failed && (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-fg">
            <CircleAlert size={16} aria-hidden className="shrink-0" />
            {t("composerFailed")}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <span className="mr-auto hidden text-xs text-content-quaternary sm:inline">{t("composerShortcut", { keys: shortcut })}</span>
          <ActionPill label={t("cancel")} onClick={onClose} />
          <button
            type="submit"
            // Pendant l'envoi, le bouton ne pâlit pas : il travaille (anneau).
            disabled={empty}
            aria-busy={pending || undefined}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-5 text-[13px] font-bold text-cta-primary-fg outline-none transition-[background-color,transform] duration-150 hover:bg-cta-primary-bg-hover active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
          >
            {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Send size={15} aria-hidden />}
            {pending ? t("sending") : t("send")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
