import { PageTransition } from "../components/PageTransition";
import { HelpGuides } from "../components/help/HelpGuides";
import { TicketBoard } from "../components/support/TicketBoard";

/**
 * Page « Aide » (route /support) : les guides d'abord — lire avant d'écrire —,
 * puis le tableau de ses propres tickets.
 */
export function Support() {
  return (
    <PageTransition>
      <div className="px-4 pt-16 pb-16 md:px-12">
        <HelpGuides />
        <TicketBoard scope="mine" />
      </div>
    </PageTransition>
  );
}
