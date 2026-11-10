import { memo } from "react";
import { CloudIcon as Cloud } from "@phosphor-icons/react/dist/csr/Cloud";
import { MonitorIcon as Monitor } from "@phosphor-icons/react/dist/csr/Monitor";
import { MusicNoteIcon as Music2 } from "@phosphor-icons/react/dist/csr/MusicNote";
import { HardDrivesIcon as Server } from "@phosphor-icons/react/dist/csr/HardDrives";
import { UserGearIcon as UserCog } from "@phosphor-icons/react/dist/csr/UserGear";
import { useTranslation } from "react-i18next";
import type { SettingScope } from "@tentacle-tv/shared";

/**
 * La portée d'un réglage du web et du bureau : celles du catalogue partagé
 * (`account`, `device`), plus `server` (l'administration : tous les
 * utilisateurs), `user` (l'administration encore : le compte CHOISI seulement —
 * un droit de la fiche d'un utilisateur) et `octave` (un réglage d'Octave qui
 * ne touche pas Tentacle).
 */
export type WebSettingScope = SettingScope | "server" | "user" | "octave";

const ICONS = { account: Cloud, device: Monitor, server: Server, user: UserCog, octave: Music2 } as const;

interface ScopeBadgeProps {
  scope: WebSettingScope;
  className?: string;
}

/**
 * La pastille « Compte » / « Cet appareil » / « Tout le serveur » / « Octave
 * seulement » : un mot ET une icône, jamais la couleur seule — la même que
 * celle du mobile (`settingsMobile` › `scope`). C'est la PUCE du socle
 * (`.chip`, refonte de nov. 2026) : le compte prend la teinte franche
 * (`.chip-accent`), le reste reste neutre. Une seule pastille pour toutes les
 * pages de réglages du web, du bureau et d'Octave : jamais une copie.
 */
export const ScopeBadge = memo(function ScopeBadge({ scope, className }: ScopeBadgeProps) {
  const { t } = useTranslation("settingsMobile");
  const Icon = ICONS[scope];
  return (
    <span
      role="note"
      aria-label={t(`scope.${scope}A11y`)}
      title={t(`scope.${scope}A11y`)}
      className={`chip shrink-0${scope === "account" ? " chip-accent" : ""}${className ? ` ${className}` : ""}`}
    >
      <Icon size={13} weight="bold" aria-hidden />
      {t(`scope.${scope}`)}
    </span>
  );
});
