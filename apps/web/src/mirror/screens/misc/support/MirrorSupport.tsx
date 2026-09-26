import { useMemo } from "react";
import { getUserInfo } from "../../../../components/userMenu/menuItems";
import { useTicketBoardUrlState } from "../../../../components/support/useTicketBoardUrlState";
import { AmbientGlow } from "../shared/AmbientGlow";
import { useBackOrHome } from "../shared/backOrHome";
import { TicketComposerView } from "./TicketComposerView";
import { TicketDetailView } from "./TicketDetailView";
import { TicketListView } from "./TicketListView";
import "../../../mirror.css";
import "../shared/screens.css";

/**
 * `SupportScreen` de l'app (`/support`) : liste → nouveau ticket → détail.
 * La vue vit dans l'adresse (`?new=1`, `?ticketId=`), comme le tableau du
 * bureau : les liens des notifications ouvrent la fiche, et le retour du
 * navigateur revient à la liste.
 */
export function MirrorSupport() {
  const url = useTicketBoardUrlState();
  const goBack = useBackOrHome();
  // L'admin voit tous les tickets, avec leur auteur (miroir `tentacle_user`).
  const isAdmin = useMemo(() => getUserInfo().isAdmin, []);

  let view;
  if (url.ticketId) {
    view = <TicketDetailView ticketId={url.ticketId} isAdmin={isAdmin} onBack={url.closeTicket} />;
  } else if (url.composing) {
    view = <TicketComposerView onBack={url.closeComposer} onCreated={url.openTicket} />;
  } else {
    view = <TicketListView isAdmin={isAdmin} onBack={goBack} onNew={url.openComposer} onOpen={url.openTicket} />;
  }

  return (
    <div className="relative">
      <AmbientGlow />
      <div className="relative">{view}</div>
    </div>
  );
}
