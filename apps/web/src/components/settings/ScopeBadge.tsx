import { memo } from "react";
import { Cloud, Monitor, Music2, Server } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SettingScope } from "@tentacle-tv/shared";

/**
 * La portée d'un réglage du web et du bureau : celles du catalogue partagé
 * (`account`, `device`), plus `server` (l'administration : tous les
 * utilisateurs) et `octave` (un réglage d'Octave qui ne touche pas Tentacle).
 */
export type WebSettingScope = SettingScope | "server" | "octave";

const ICONS = { account: Cloud, device: Monitor, server: Server, octave: Music2 } as const;

interface ScopeBadgeProps {
  scope: WebSettingScope;
  className?: string;
}

/**
 * La pastille « Compte » / « Cet appareil » / « Tout le serveur » / « Octave
 * seulement » : un mot ET une icône, jamais la couleur seule — la même que
 * celle du mobile (`settingsMobile` › `scope`). Le compte prend la teinte de
 * marque, le reste reste neutre. Une seule pastille pour toutes les pages de
 * réglages du web, du bureau et d'Octave : jamais une copie.
 */
export const ScopeBadge = memo(function ScopeBadge({ scope, className }: ScopeBadgeProps) {
  const { t } = useTranslation("settingsMobile");
  const Icon = ICONS[scope];
  const tone = scope === "account"
    ? "border-tentacle-accent/30 bg-tentacle-accent/10 text-tentacle-accent-light"
    : "border-line-subtle bg-white/5 text-content-tertiary";
  return (
    <span
      role="note"
      aria-label={t(`scope.${scope}A11y`)}
      title={t(`scope.${scope}A11y`)}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold leading-none ${tone}${className ? ` ${className}` : ""}`}
    >
      <Icon size={10} aria-hidden />
      {t(`scope.${scope}`)}
    </span>
  );
});
