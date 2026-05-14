import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AdminIcon, CreditsIcon, HelpIcon, InfoIcon, PairIcon, SettingsIcon } from "../userMenu/icons";

interface Props {
  isAdmin: boolean;
}

interface LinkDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

/**
 * Liste de liens "réguliers" du Profile mobile (Préférences, Admin, Jumelage,
 * About, Aide, Crédits). Style row avec chevron, séparateurs internes.
 */
export function ProfileLinks({ isAdmin }: Props) {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();

  const links: LinkDef[] = [
    { key: "settings", label: t("preferences"), icon: <SettingsIcon />, path: "/settings" },
    ...(isAdmin
      ? [{ key: "admin", label: t("admin"), icon: <AdminIcon />, path: "/admin" }]
      : []),
    { key: "pair", label: t("pairDevice"), icon: <PairIcon />, path: "/pair-device" },
    { key: "about", label: t("about"), icon: <InfoIcon />, path: "/about" },
    { key: "help", label: t("help"), icon: <HelpIcon />, path: "/support" },
    { key: "credits", label: t("credits"), icon: <CreditsIcon />, path: "/credits" },
  ];

  return (
    <section
      className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]"
      aria-label={t("profile")}
    >
      <ul className="divide-y divide-white/[0.05]">
        {links.map((link) => (
          <li key={link.key}>
            <button
              type="button"
              onClick={() => navigate(link.path)}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-[15px] text-white/85 transition-colors duration-150 active:bg-white/[0.04]"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/70">
                {link.icon}
              </span>
              <span className="flex-1">{link.label}</span>
              <span className="flex-shrink-0 text-white/30" aria-hidden>›</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
