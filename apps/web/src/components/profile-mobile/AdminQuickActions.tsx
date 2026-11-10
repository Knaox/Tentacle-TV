import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PuzzlePieceIcon } from "@phosphor-icons/react/dist/csr/PuzzlePiece";
import { TicketIcon } from "@phosphor-icons/react/dist/csr/Ticket";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";

interface ActionDef {
  key: string;
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
}

/**
 * 4 cartes raccourcis pour les admins (Utilisateurs, Invitations, Tickets,
 * Plugins) — affichées dans MobileProfile uniquement si l'utilisateur est
 * admin. Chacune mène à sa ROUTE : les ancres `/admin#invites` et
 * `/admin#tickets` dataient de l'ancien accueil en une page, et ouvraient un
 * panneau vide depuis que l'administration est découpée en sections.
 */
export function AdminQuickActions() {
  const { t } = useTranslation("admin");
  const { t: tNav } = useTranslation("nav");
  const navigate = useNavigate();

  const actions: ActionDef[] = [
    {
      key: "users",
      title: t("usersTitle"),
      description: t("usersDescription"),
      path: "/admin/users",
      icon: <UsersIcon aria-hidden size={20} />,
    },
    {
      key: "invites",
      title: t("generateInvite"),
      description: t("existingInvites"),
      path: "/admin/invites",
      icon: <UserPlusIcon aria-hidden size={20} />,
    },
    {
      key: "tickets",
      title: t("supportTickets"),
      description: t("ticketAll"),
      path: "/admin/tickets",
      icon: <TicketIcon aria-hidden size={20} />,
    },
    {
      key: "plugins",
      title: t("managePlugins"),
      description: t("pluginsDescription"),
      path: "/admin/plugins",
      icon: <PuzzlePieceIcon aria-hidden size={20} />,
    },
  ];

  return (
    <section aria-label={tNav("admin")}>
      <h2 className="ui-eyebrow mb-3 px-1 font-sans">
        {tNav("admin")}
      </h2>
      {/* Deux par rangée : quatre cartes sur trois colonnes laissaient la
          dernière seule sur sa ligne. */}
      <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => navigate(a.path)}
            className="ui-tile flex items-center gap-3 p-3 text-left hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus xs:flex-col xs:items-start"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field bg-accent-soft text-accent">
              {a.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-content-primary">{a.title}</span>
              <span className="mt-0.5 block truncate text-xs text-content-tertiary">{a.description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
