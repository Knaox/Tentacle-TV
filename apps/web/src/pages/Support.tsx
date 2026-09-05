import { PageTransition } from "../components/PageTransition";
import { TicketBoard } from "../components/support/TicketBoard";

/** Page « Support » (route /support) : le tableau de ses propres tickets. */
export function Support() {
  return (
    <PageTransition>
      <div className="px-4 pt-16 pb-16 md:px-12">
        <TicketBoard scope="mine" />
      </div>
    </PageTransition>
  );
}
