import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface ActionDef {
  key: string;
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
}

/**
 * 3 cartes raccourcis pour les admins (Invites, Tickets, Plugins) — affichées
 * dans MobileProfile uniquement si l'utilisateur est admin.
 */
export function AdminQuickActions() {
  const { t } = useTranslation("admin");
  const { t: tNav } = useTranslation("nav");
  const navigate = useNavigate();

  const actions: ActionDef[] = [
    {
      key: "invites",
      title: t("generateInvite"),
      description: t("existingInvites"),
      path: "/admin#invites",
      icon: <InviteIcon />,
    },
    {
      key: "tickets",
      title: t("supportTickets"),
      description: t("ticketAll"),
      path: "/admin#tickets",
      icon: <TicketIcon />,
    },
    {
      key: "plugins",
      title: t("managePlugins"),
      description: t("pluginsDescription"),
      path: "/admin/plugins",
      icon: <PluginIcon />,
    },
  ];

  return (
    <section aria-label={tNav("admin")}>
      <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-white/40">
        {tNav("admin")}
      </h2>
      <div className="grid grid-cols-1 gap-2 xs:grid-cols-3">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => navigate(a.path)}
            className="flex items-center gap-3 rounded-xl border border-[rgba(var(--brand-rgb),0.2)] bg-[var(--brand)]/[0.08] p-3 text-left transition-colors duration-150 active:bg-[var(--brand)]/[0.14] xs:flex-col xs:items-start"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(var(--brand-rgb),0.2)] text-[var(--brand-light)]">
              {a.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{a.title}</span>
              <span className="mt-0.5 block truncate text-xs text-white/45">{a.description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function InviteIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  );
}

function PluginIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.355a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.036 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
    </svg>
  );
}
