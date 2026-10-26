import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { MailPlus, Users } from "lucide-react";

export type UsersTab = "users" | "invites";

/** Chaque onglet garde SON adresse : `/admin/users`, `/admin/invites` (liens profonds, tuiles de la vue d'ensemble). */
const TABS: ReadonlyArray<{ id: UsersTab; to: string; labelKey: string; icon: ReactNode }> = [
  { id: "users", to: "/admin/users", labelKey: "usersTabAccounts", icon: <Users size={15} /> },
  { id: "invites", to: "/admin/invites", labelKey: "usersTabInvites", icon: <MailPlus size={15} /> },
];

/** Les pilules des onglets du kit (`ui/Tabs`) : un seul langage pour « choisir parmi ». */
const PILL =
  "lg-glass-btn inline-flex h-9 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-line-focus";
const SELECTED = "lg-glass-selected border-[rgba(var(--brand-rgb),0.45)] bg-[var(--brand-soft)] text-[var(--brand-light)]";
const IDLE = "border-line-subtle bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary";

/**
 * Les onglets d'« Utilisateurs » : les comptes, et les invitations qui en
 * créent (demande de Damien du 26/10 : « Invitations pourrait être dans une
 * section Utilisateurs »). Le rail n'a plus qu'une entrée, qui reste allumée
 * sur les deux (`activeAdminSection`).
 *
 * Des LIENS (`aria-current`), pas le motif « Tabs » : chaque onglet est une
 * page à son adresse, sans panneau dans celle-ci. Changer d'onglet REMPLACE
 * l'adresse : Retour quitte la section au lieu de rejouer les onglets.
 */
export function UsersTabs({ active }: { active: UsersTab }) {
  const { t } = useTranslation("admin");
  return (
    <nav aria-label={t("usersTabsLabel")} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            replace
            aria-current={selected ? "page" : undefined}
            className={`${PILL} ${selected ? SELECTED : IDLE}`}
          >
            <span aria-hidden="true" className="flex">{tab.icon}</span>
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
