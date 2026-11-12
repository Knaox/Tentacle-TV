import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import type { WtChatMessageDto } from "@tentacle-tv/shared";
import "./chatAdmin.css";

/** L'heure dans la langue de l'INTERFACE (24 h en français), pas dans celle du système. */
export function formatChatTime(at: number, language: string): string {
  return new Date(at).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Watch Together — un message de l'ADMINISTRATION (« Message au groupe » du tableau de bord des
 * sessions) : une note sur toute la largeur du fil — ni une bulle à soi, ni celle d'un membre, même
 * quand l'administrateur est dans la salle. Le compositeur de l'administration en montre l'aperçu.
 */
export const AdminChatNote = memo(function AdminChatNote({
  message,
  arriving = false,
  language,
}: {
  message: Pick<WtChatMessageDto, "at" | "header" | "text" | "username">;
  arriving?: boolean;
  language: string;
}) {
  const { t } = useTranslation("watchTogether");
  const time = formatChatTime(message.at, language);
  return (
    <div className={arriving ? "wtc-admin wtc-row--in" : "wtc-admin"} role="note" title={message.username || undefined}>
      <div className="wtc-admin__meta">
        <ShieldCheckIcon size={13} weight="bold" aria-hidden />
        <span>{t("chatAdmin")}</span>
        <time className="wtc-meta__time" dateTime={new Date(message.at).toISOString()}>{time}</time>
      </div>
      {message.header && <p className="wtc-admin__header">{message.header}</p>}
      <p className="wtc-admin__text">{message.text}</p>
    </div>
  );
});
