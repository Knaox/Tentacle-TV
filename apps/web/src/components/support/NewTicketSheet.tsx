import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useCreateTicket, TICKET_CATEGORIES, type TicketCategory } from "@tentacle-tv/api-client";
import { Sheet } from "../ui/Sheet";
import { useIsMobile } from "../../hooks/useIsMobile";
import { MediaSelector, type MediaSelection } from "./MediaSelector";
import { TICKET_CATEGORY_LABEL_KEYS } from "./ticketMeta";

interface NewTicketSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

const MOBILE_HEIGHT_RATIO = 0.92;
const DESKTOP_WIDTH = 520;

/** Le formulaire de création, dans le même volet que la fiche (`?new=1`). */
export function NewTicketSheet({ open, onClose, onCreated }: NewTicketSheetProps) {
  const isMobile = useIsMobile();
  const size = isMobile ? Math.round(window.innerHeight * MOBILE_HEIGHT_RATIO) : DESKTOP_WIDTH;
  return (
    <Sheet open={open} onClose={onClose} placement={isMobile ? "bottom" : "right"} size={size}>
      {/* Remonté à chaque ouverture : le formulaire repart vierge. */}
      {open && <NewTicketForm onCancel={onClose} onCreated={onCreated} />}
    </Sheet>
  );
}

const INPUT =
  "w-full rounded-lg border border-line-subtle bg-tentacle-surface px-4 py-2.5 text-sm text-content-primary placeholder-content-quaternary outline-none focus:ring-1 focus:ring-[rgba(var(--brand-rgb),0.5)]";

function NewTicketForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation("tickets");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("general");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<MediaSelection | null>(null);
  const createMut = useCreateTicket();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    createMut.mutate(
      { subject: subject.trim(), category, body: body.trim(), mediaItemId: media?.itemId, mediaItemName: media?.displayName },
      { onSuccess: (tk) => onCreated(tk.id) },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-content-primary">{t("newTicket")}</h2>
        <button type="button" onClick={onCancel} className="text-sm text-content-tertiary hover:text-content-primary">
          {t("common:cancel")}
        </button>
      </div>
      <div>
        <label className="mb-1 block text-xs text-content-tertiary">{t("subject")}</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("subjectPlaceholder")} className={INPUT} maxLength={300} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-content-tertiary">{t("category")}</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as TicketCategory)}
          className={`${INPUT} appearance-none [&>option]:bg-tentacle-surface [&>option]:text-content-primary`}
        >
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(TICKET_CATEGORY_LABEL_KEYS[c])}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-content-tertiary">{t("relatedMedia")}</label>
        <MediaSelector selection={media} onSelect={setMedia} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-content-tertiary">{t("message")}</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("messagePlaceholder")} rows={6} className={`${INPUT} resize-none`} maxLength={5000} />
      </div>
      <button
        type="submit"
        disabled={createMut.isPending || !subject.trim() || !body.trim()}
        className="h-11 self-start rounded-lg bg-cta-primary-bg px-5 text-sm font-bold text-cta-primary-fg hover:bg-cta-primary-bg-hover disabled:opacity-50"
      >
        {createMut.isPending ? t("common:sending") : t("createTicket")}
      </button>
    </form>
  );
}
