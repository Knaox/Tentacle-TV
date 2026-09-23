import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../../ui/Modal";
import { cls } from "../../../pages/adminUtils";
import type { MessageInput } from "../../../hooks/useAdminSessions";

/**
 * La rédaction d'un message à une session — ou à tout un groupe Watch
 * Together. Le titre est facultatif ; la durée d'affichage par défaut est
 * « jusqu'à ce qu'il soit fermé », parce qu'un message d'administrateur est
 * fait pour être lu.
 */

const TEXT_MAX = 1_000;
const HEADER_MAX = 100;
const DURATIONS = [
  { value: "", key: "durationUntilClosed" },
  { value: "10000", key: "duration10" },
  { value: "30000", key: "duration30" },
  { value: "60000", key: "duration60" },
] as const;

export function MessageComposer({
  title,
  pending,
  onSend,
  onClose,
}: {
  /** Déjà traduit : « Message à Alice », « Message au groupe ». */
  title: string;
  pending: boolean;
  onSend: (input: MessageInput) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("sessions");
  const titleId = useId();
  const headerId = useId();
  const textId = useId();
  const durationId = useId();
  const [header, setHeader] = useState("");
  const [text, setText] = useState("");
  const [duration, setDuration] = useState("");
  const ready = text.trim().length > 0 && !pending;

  return (
    <Modal open onClose={onClose} labelledBy={titleId} maxWidth={520}>
      <form
        className="space-y-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          onSend({
            header: header.trim(),
            text: text.trim(),
            ...(duration === "" ? {} : { timeoutMs: Number(duration) }),
          });
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold text-content-primary">{title}</h2>
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
            rows={4}
            maxLength={TEXT_MAX}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className={`${cls.inp} h-auto resize-y py-2 leading-relaxed`}
          />
          <p className="mt-1 text-right text-xs tabular-nums text-content-quaternary">{text.length} / {TEXT_MAX}</p>
        </div>
        <div>
          <label htmlFor={durationId} className={cls.lbl}>{t("composerDuration")}</label>
          <select id={durationId} className={cls.inp} value={duration} onChange={(event) => setDuration(event.target.value)}>
            {DURATIONS.map((d) => (
              <option key={d.key} value={d.value}>{t(d.key)}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={cls.bs} onClick={onClose}>{t("cancel")}</button>
          <button type="submit" className={cls.bp} disabled={!ready}>{pending ? t("sending") : t("send")}</button>
        </div>
      </form>
    </Modal>
  );
}
