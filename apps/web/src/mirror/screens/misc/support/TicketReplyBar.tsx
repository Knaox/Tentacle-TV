import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { useReplyTicket } from "@tentacle-tv/api-client";
import { useChromeInsets, useMirrorChrome } from "../../../useMirrorLayout";
import { Spinner } from "../shared/Spinner";

/**
 * La barre de réponse de `TicketDetailView` : filet haut, padding 12 × 16,
 * champ multiligne 44 → 120 (rayon 8), bouton d'envoi 44 carré rayon 8 au
 * halo violet (0/4/14). Dans l'app elle est collée au bas de l'écran ; ici,
 * collée au-dessus de la barre d'onglets (ou du bas sur le rail).
 */
export function TicketReplyBar({ ticketId }: { ticketId: string }) {
  const { t } = useTranslation("tickets");
  const chrome = useMirrorChrome();
  const insets = useChromeInsets();
  const reply = useReplyTicket();
  const [body, setBody] = useState("");
  const disabled = !body.trim() || reply.isPending;

  const send = () => {
    if (disabled) return;
    reply.mutate({ ticketId, body: body.trim() }, { onSuccess: () => setBody("") });
  };

  return (
    <div
      className="sticky z-10 flex items-end border-t border-line-subtle bg-surface-sheet"
      style={{ bottom: chrome === "tabs" ? insets.bottom : 0, padding: "12px 16px", gap: 8 }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        rows={1}
        placeholder={t("replyPlaceholder")}
        aria-label={t("replyPlaceholder")}
        className="min-w-0 flex-1 resize-none rounded-lg border border-line-subtle bg-fill-subtle text-content-primary outline-none [field-sizing:content] placeholder:text-content-quaternary"
        style={{ minHeight: 44, maxHeight: 120, padding: "10px 14px", fontSize: 16 }}
      />
      <button
        type="button"
        onClick={send}
        disabled={disabled}
        aria-label={t("common:send")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cta-primary-bg text-cta-primary-fg active:opacity-[0.88]"
        style={{ ...(disabled ? { opacity: 0.4 } : null), boxShadow: disabled ? "none" : "0 4px 14px rgba(var(--brand-rgb), 0.45)" }}
      >
        {reply.isPending ? <Spinner size={16} color="var(--cta-primary-fg)" /> : <Send size={18} />}
      </button>
    </div>
  );
}
