import { PageTransition } from "../components/PageTransition";
import { BackButton } from "../components/ui/BackButton";
import { HelpGuides } from "../components/help/HelpGuides";
import { TicketBoard } from "../components/support/TicketBoard";

/**
 * Page « Aide » (route /support) : les guides d'abord — lire avant d'écrire —,
 * puis le tableau de ses propres tickets. Le bouton Retour commun est à gauche
 * du premier titre de la page (« Guides »).
 */
export function Support() {
  return (
    <PageTransition>
      <div className="px-4 pt-16 pb-16 md:px-12">
        <div className="flex items-start gap-3">
          <BackButton fallback="/" className="-ml-1 -mt-1.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <HelpGuides />
          </div>
        </div>
        <TicketBoard scope="mine" />
      </div>
    </PageTransition>
  );
}
