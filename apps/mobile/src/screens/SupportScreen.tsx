import { useState, useCallback } from "react";
import { TicketListView } from "../components/support/TicketListView";
import { TicketComposerView } from "../components/support/TicketComposerView";
import { TicketDetailView } from "../components/support/TicketDetailView";

type ScreenView = "list" | "new" | "detail";

interface SupportScreenProps {
  initialTicketId?: string;
}

export function SupportScreen({ initialTicketId }: SupportScreenProps) {
  const [view, setView] = useState<ScreenView>(initialTicketId ? "detail" : "list");
  const [selectedId, setSelectedId] = useState<string | null>(initialTicketId ?? null);

  const openTicket = useCallback((id: string) => {
    setSelectedId(id);
    setView("detail");
  }, []);
  const goBack = useCallback(() => setView("list"), []);

  if (view === "new") {
    return <TicketComposerView onBack={goBack} onCreated={openTicket} />;
  }
  if (view === "detail" && selectedId) {
    return (
      <TicketDetailView
        ticketId={selectedId}
        onBack={goBack}
        hideBack={!!initialTicketId && selectedId === initialTicketId}
      />
    );
  }
  return <TicketListView onNew={() => setView("new")} onOpen={openTicket} />;
}
