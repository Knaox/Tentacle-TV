import { useTranslation } from "react-i18next";
import { PageTransition } from "../components/PageTransition";
import { BackButton } from "../components/ui/BackButton";
import { HelpGuides } from "../components/help/HelpGuides";
import { TicketBoard } from "../components/support/TicketBoard";

/**
 * Page « Aide » (route /support) : les guides d'abord — lire avant d'écrire —,
 * puis le tableau de ses propres tickets. En tête, l'en-tête des pages de
 * réglages et d'administration : le bouton Retour commun, puis le nom de la
 * page (elle n'avait pas de titre : « Guides » en tenait lieu).
 */
export function Support() {
  const { t } = useTranslation("nav");
  return (
    <PageTransition>
      <div className="px-4 pb-16 pt-6 md:px-12">
        <header className="mb-7 flex items-center gap-3">
          <BackButton fallback="/" className="-ml-1 shrink-0" />
          <h1 className="text-[1.875rem] font-[650] leading-[1.15] tracking-[-0.02em] text-content-primary">{t("help")}</h1>
        </header>
        <HelpGuides />
        <TicketBoard scope="mine" />
      </div>
    </PageTransition>
  );
}
