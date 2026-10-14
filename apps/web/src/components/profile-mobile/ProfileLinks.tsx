import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AdminIcon, CreditsIcon, HelpIcon, InfoIcon, PairIcon, SettingsIcon, StatsIcon } from "../userMenu/icons";
import { profileSessionRefusals } from "../userMenu/menuItems";
import { useActiveProfile } from "../../auth/profileSession";
import { useProfileMenuItems } from "../../profiles/switcher/useProfileMenuItems";

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
 * Liste de liens "réguliers" du Profile mobile (Mes statistiques, Préférences,
 * Admin, Jumelage, About, Aide, Crédits). Style row avec chevron, séparateurs
 * internes. La page n'est atteinte qu'en ligne (`/profile` est `onlineOnly`).
 * Bureau, session d'un profil : la règle du menu de l'avatar
 * (`profileSessionRefusals`) — ni jumelage, ni Aide pour un invité. Bureau,
 * famille : « Changer de profil » en tête, dans son propre bloc, comme dans
 * le menu de l'avatar (`useProfileMenuItems`) — sur macOS, la barre du haut
 * d'une fenêtre étroite passe sous la bande de la fenêtre : cette page est
 * alors le seul chemin vers « Qui regarde ? ».
 */
export function ProfileLinks({ isAdmin }: Props) {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const active = useActiveProfile();
  const refused = active ? profileSessionRefusals({ guest: active.kind === "guest" }) : null;
  const profileItems = useProfileMenuItems(noop);

  const links: LinkDef[] = [
    { key: "stats", label: t("stats"), icon: <StatsIcon />, path: "/stats" },
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
    <>
      {profileItems.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line-subtle bg-fill-faint">
          <ul className="divide-y divide-line-subtle">
            {profileItems.map((item) => (
              <li key={item.key}>
                <LinkRow icon={item.icon} label={item.label} onClick={item.action} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <section
        className="overflow-hidden rounded-2xl border border-line-subtle bg-fill-faint"
        aria-label={t("profile")}
      >
        <ul className="divide-y divide-line-subtle">
          {links.filter((link) => !refused?.has(link.key)).map((link) => (
            <li key={link.key}>
              <LinkRow icon={link.icon} label={link.label} onClick={() => navigate(link.path)} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function noop(): void {}

/** Une ligne de la page : pictogramme sur pastille, libellé, chevron. */
function LinkRow({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-[15px] text-content-secondary transition-colors duration-150 active:bg-fill-faint"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-fill-subtle text-content-secondary">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <span className="flex-shrink-0 text-content-quaternary" aria-hidden>›</span>
    </button>
  );
}
