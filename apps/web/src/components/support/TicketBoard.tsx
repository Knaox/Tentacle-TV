import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "../../hooks/useIsMobile";
import { EmptyState } from "../ui/EmptyState";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { SelectionToolbar } from "../SelectionToolbar";
import { TicketColumn } from "./TicketColumn";
import { TicketStatusTabs } from "./TicketStatusTabs";
import { TicketDetailSheet } from "./TicketDetailSheet";
import { NewTicketSheet } from "./NewTicketSheet";
import { TICKET_STATUSES, type TicketStatus } from "./ticketMeta";
import { useTicketBoard, type TicketBoardScope } from "./useTicketBoard";
import { useTicketBoardUrlState } from "./useTicketBoardUrlState";
import { useTicketSelection } from "./useTicketSelection";

/**
 * Le tableau des tickets, façon Jira : une colonne par statut. La page de
 * support (`mine`) et l'admin (`all`) rendent le même composant ; seul
 * l'admin déplace les cartes. Sous 768 px : onglets de statut et une seule
 * colonne. La fiche et le formulaire vivent dans l'adresse (`?ticketId=`,
 * `?new=1`).
 */
export function TicketBoard({ scope }: { scope: TicketBoardScope }) {
  const { t } = useTranslation("tickets");
  const isMobile = useIsMobile();
  const board = useTicketBoard(scope);
  const url = useTicketBoardUrlState();
  const sel = useTicketSelection();
  const selection = scope === "all" && sel.isSelecting ? { isSelected: sel.isSelected, toggle: sel.toggle } : null;
  const allIds = TICKET_STATUSES.flatMap((s) => board.columns[s].map((tk) => tk.id));
  const counts = Object.fromEntries(
    TICKET_STATUSES.map((s) => [s, board.columns[s].length]),
  ) as Record<TicketStatus, number>;
  // Onglet mobile : celui que l'utilisateur a choisi, sinon la première
  // colonne non vide — atterrir sur « Ouverts » vide alors qu'un ticket est
  // en cours ferait croire à un tableau désert.
  const [chosenTab, setTab] = useState<TicketStatus | null>(null);
  const tab = chosenTab ?? TICKET_STATUSES.find((s) => counts[s] > 0) ?? "open";
  // Les deux règles de cycle de vie du serveur, rappelées là où elles jouent.
  const hints: Partial<Record<TicketStatus, string>> = {
    resolved: t("resolvedAutoClose"),
    closed: t("closedAutoHide"),
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {scope === "mine" && (
          <h2 className="text-lg font-semibold text-content-primary">{t("myTickets")}</h2>
        )}
        <input
          type="search"
          value={board.search}
          onChange={(e) => board.setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-11 w-full rounded-lg border border-line-subtle bg-tentacle-surface px-4 text-sm text-content-primary placeholder-content-quaternary outline-none focus:ring-1 focus:ring-[rgba(var(--brand-rgb),0.5)] sm:w-64"
        />
        <div className="flex-1" />
        {scope === "mine" && (
          <button
            type="button"
            onClick={url.openComposer}
            className="h-11 flex-shrink-0 rounded-lg bg-cta-primary-bg px-5 text-sm font-bold text-cta-primary-fg hover:bg-cta-primary-bg-hover"
          >
            {t("newTicket")}
          </button>
        )}
        {scope === "all" && !sel.isSelecting && (
          <button
            type="button"
            onClick={sel.enterSelectionMode}
            className="h-11 flex-shrink-0 rounded-lg border border-line-subtle bg-fill-subtle px-4 text-sm font-medium text-content-secondary hover:bg-fill-soft"
          >
            {t("select")}
          </button>
        )}
      </div>

      {board.hiddenCount > 0 && (
        <p className="mb-3 text-xs text-content-quaternary">{t("olderHidden", { count: board.hiddenCount })}</p>
      )}

      {board.isError ? (
        <EmptyState title={t("loadFailed")} />
      ) : isMobile ? (
        <>
          <TicketStatusTabs active={tab} counts={counts} onChange={setTab} />
          <TicketColumn
            status={tab}
            tickets={board.columns[tab]}
            scope={scope}
            canDrop={false}
            isLoading={board.isLoading}
            single
            hint={hints[tab]}
            onOpen={url.openTicket}
            onDrop={board.moveTicket}
            selection={selection}
          />
        </>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {TICKET_STATUSES.map((status) => (
            <TicketColumn
              key={status}
              status={status}
              tickets={board.columns[status]}
              scope={scope}
              canDrop={board.canMove}
              isLoading={board.isLoading}
              hint={hints[status]}
              onOpen={url.openTicket}
              onDrop={board.moveTicket}
              selection={selection}
            />
          ))}
        </div>
      )}

      <TicketDetailSheet
        ticketId={url.ticketId}
        scope={scope}
        canMove={board.canMove}
        onMove={board.moveTicket}
        onClose={url.closeTicket}
      />
      {scope === "mine" && (
        <NewTicketSheet open={url.composing} onClose={url.closeComposer} onCreated={url.openTicket} />
      )}
      {selection && (
        <SelectionToolbar
          count={sel.count}
          onSelectAll={() => sel.selectAll(allIds)}
          onCancel={sel.exitSelectionMode}
          onDelete={sel.requestDelete}
          isDeleting={sel.isDeleting}
        />
      )}
      <ConfirmDialog
        open={sel.confirming}
        title={t("deleteConfirmTitle", { count: sel.count })}
        message={t("deleteConfirmBody")}
        confirmLabel={t("deleteTicket", { count: sel.count })}
        cancelLabel={t("common:cancel")}
        danger
        pending={sel.isDeleting}
        onCancel={sel.cancelDelete}
        onConfirm={sel.confirmDelete}
      />
    </div>
  );
}
