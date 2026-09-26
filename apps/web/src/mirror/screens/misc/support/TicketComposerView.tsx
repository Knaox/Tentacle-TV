import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { useCreateTicket } from "@tentacle-tv/api-client";
import { useContentPadding } from "../../../useMirrorLayout";
import { PrimaryCta } from "../shared/PrimaryCta";
import { ScreenTitle } from "../shared/ScreenTitle";
import { FIELD_LABEL_STYLE, INPUT_CLASS, INPUT_STYLE } from "./formStyles";
import { Chip } from "./Chip";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL_KEYS, type TicketCategory } from "./ticketMeta";

/**
 * `TicketComposerView` de l'app : colonne de 720, tête chevron 40 + titre 26
 * (marge 24) ; sujet, catégorie en chips, message de 160 ; CTA « Créer »
 * avec l'icône d'envoi, à 28 du message.
 */
export function TicketComposerView({ onBack, onCreated }: {
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation("tickets");
  const pad = useContentPadding(720);
  const create = useCreateTicket();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("general");
  const [body, setBody] = useState("");

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !create.isPending;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    create.mutate(
      { subject: subject.trim(), category, body: body.trim() },
      // Comme l'app : un échec laisse le formulaire rempli, sans message.
      { onSuccess: (ticket) => onCreated(ticket.id) },
    );
  }, [canSubmit, create, subject, category, body, onCreated]);

  return (
    <div style={{ paddingTop: 12, paddingBottom: 80, paddingLeft: pad, paddingRight: pad }}>
      <ScreenTitle title={t("newTicket")} onBack={onBack} size={26} gap={8} className="mb-6" />

      <label htmlFor="mirror-ticket-subject" style={FIELD_LABEL_STYLE}>{t("subject")}</label>
      <input
        id="mirror-ticket-subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={300}
        placeholder={t("subjectPlaceholder")}
        className={INPUT_CLASS}
        style={INPUT_STYLE}
      />

      <span style={{ ...FIELD_LABEL_STYLE, marginTop: 20 }}>{t("category")}</span>
      <div className="mirror-no-scrollbar flex overflow-x-auto" style={{ gap: 8, padding: "4px 0" }}>
        {TICKET_CATEGORIES.map((c) => (
          <Chip key={c} label={t(TICKET_CATEGORY_LABEL_KEYS[c])} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </div>

      <label htmlFor="mirror-ticket-body" style={{ ...FIELD_LABEL_STYLE, marginTop: 20 }}>{t("message")}</label>
      <textarea
        id="mirror-ticket-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        placeholder={t("messagePlaceholder")}
        className={`${INPUT_CLASS} resize-none`}
        style={{ ...INPUT_STYLE, height: 160, paddingTop: 14 }}
      />

      <PrimaryCta onPress={submit} disabled={!canSubmit} loading={create.isPending} style={{ marginTop: 28 }}>
        <Send size={14} />
        {t("createTicket")}
      </PrimaryCta>
    </div>
  );
}
