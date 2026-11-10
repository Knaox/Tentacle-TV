import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useReplyTicket } from "@tentacle-tv/api-client";

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const { t } = useTranslation("tickets");
  const [reply, setReply] = useState("");
  const replyMut = useReplyTicket();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = reply.trim();
    if (!body) return;
    replyMut.mutate({ ticketId, body }, { onSuccess: () => setReply("") });
  };

  return (
    <form onSubmit={submit} className="border-t border-line-subtle px-5 py-4">
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder={t("replyPlaceholder")}
        rows={3}
        maxLength={5000}
        className="field resize-none"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={replyMut.isPending || !reply.trim()}
          className="btn btn-solid"
        >
          {replyMut.isPending ? t("common:sending") : t("common:send")}
        </button>
      </div>
    </form>
  );
}
