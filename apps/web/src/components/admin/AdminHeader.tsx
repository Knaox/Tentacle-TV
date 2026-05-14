import { useTranslation } from "react-i18next";

interface Anchor {
  id: string;
  label: string;
}

/**
 * Barre de raccourcis ancres en tête de la page Admin — utile sur mobile pour
 * sauter rapidement à une section (Invites, Tickets, Services, Plugins) sans
 * scroller. Sur desktop, c'est juste une nav horizontale discrète.
 */
export function AdminHeader() {
  const { t } = useTranslation("admin");
  const anchors: Anchor[] = [
    { id: "invites", label: t("generateInvite") },
    { id: "tickets", label: t("supportTickets") },
    { id: "services", label: t("services") },
    { id: "devices", label: t("pairedDevices") },
  ];

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      className="mb-6 -mx-4 overflow-x-auto md:mx-0"
      aria-label={t("title")}
    >
      <div className="flex gap-2 px-4 md:px-0">
        {anchors.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => jumpTo(a.id)}
            className="flex-shrink-0 whitespace-nowrap inline-flex items-center h-9 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 text-xs font-medium text-white/75 transition-colors hover:border-[var(--brand)]/45 hover:bg-[var(--brand-soft)] hover:text-white"
          >
            {a.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
