import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, ChevronLeft, Inbox, Plus } from "lucide-react";
import { useChromeInsets, useContentPadding, useMirrorChrome } from "../../../useMirrorLayout";
import { Spinner } from "../shared/Spinner";
import { Chip } from "./Chip";
import { TicketCard } from "./TicketCard";
import { FILTERS, type TicketStatus } from "./ticketMeta";
import { useTicketList } from "./useTicketList";

/**
 * `TicketListView` de l'app : colonne de 720 ; tête chevron 26 (padding 4,
 * marge 8) + titre 28 ; rangée de chips à 16 du bord ; cartes espacées de 10 ;
 * état vide (icône 48 à 50 %, texte 15) ; bouton flottant de 56, verre violet,
 * à 20 du bord — posé au-dessus de la barre d'onglets du miroir.
 */
export function TicketListView({ isAdmin, onBack, onNew, onOpen }: {
  isAdmin: boolean;
  onBack: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("tickets");
  const pad = useContentPadding(720);
  const chrome = useMirrorChrome();
  const insets = useChromeInsets();
  const [filter, setFilter] = useState<TicketStatus | "">("");
  const { tickets, isLoading, isError } = useTicketList(isAdmin, filter);

  return (
    <div style={{ paddingTop: 12 }}>
      <div className="flex items-center" style={{ paddingLeft: pad, paddingRight: pad, paddingBottom: 8 }}>
        <button
          type="button"
          onClick={onBack}
          aria-label={t("common:back")}
          className="shrink-0 active:opacity-70"
          style={{ marginRight: 8, padding: 4, color: "var(--brand-light)" }}
        >
          <ChevronLeft size={26} />
        </button>
        <h1 className="min-w-0 flex-1 font-extrabold text-content-primary" style={{ fontSize: 28, letterSpacing: -0.6 }}>
          {t(isAdmin ? "allTickets" : "myTickets")}
        </h1>
      </div>

      <div className="mirror-no-scrollbar flex items-center overflow-x-auto" style={{ marginTop: 8, padding: "0 16px", gap: 8 }}>
        {FILTERS.map((f) => (
          <Chip key={f.key || "all"} label={t(f.tKey)} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center" style={{ marginTop: 48 }}><Spinner size={24} /></div>
      ) : isError || tickets.length === 0 ? (
        <div className="flex flex-col items-center" style={{ marginTop: 80, padding: "0 32px" }}>
          <span style={{ color: "var(--brand-light)", opacity: 0.5 }}>
            {isError ? <AlertCircle size={48} /> : <Inbox size={48} />}
          </span>
          <p className="text-center font-medium text-content-tertiary" style={{ fontSize: 15, marginTop: 16 }}>
            {t(isError ? "loadFailed" : "noTickets")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col" style={{ marginTop: 12, gap: 10, paddingLeft: pad, paddingRight: pad, paddingBottom: 96 }}>
          {tickets.map((tk) => (
            <TicketCard key={tk.id} ticket={tk} showAuthor={isAdmin} onOpen={onOpen} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onNew}
        aria-label={t("newTicket")}
        className="fixed z-30 flex items-center justify-center rounded-full border transition-transform active:scale-[0.96]"
        style={{
          right: 20,
          bottom: chrome === "tabs" ? `calc(${insets.bottom} + 16px)` : `calc(${insets.bottom} + 24px)`,
          width: 56,
          height: 56,
          background: "rgba(var(--brand-rgb), 0.18)",
          borderColor: "rgba(var(--brand-rgb), 0.45)",
          boxShadow: "0 8px 22px rgba(var(--brand-rgb), 0.55)",
          color: "var(--brand-light)",
        }}
      >
        <Plus size={26} />
      </button>
    </div>
  );
}
