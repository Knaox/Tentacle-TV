import type { ReactNode } from "react";

/**
 * Groupe de réglages — pendant web du `SettingsSection` de `apps/mobile`.
 *
 * Titre en capitales espacées, puis une carte à coins arrondis qui rogne ses
 * enfants (`overflow-hidden`) : les hairlines des `SettingsRow` s'arrêtent donc
 * proprement au bord, sans dépasser dans l'arrondi.
 *
 * C'est la primitive qui remplace les cartes ad-hoc de l'admin et des réglages :
 * un seul style de carte, une seule échelle d'espacement.
 */

export interface SettingsSectionProps {
  /** Titre du groupe. Rendu en capitales — écrire en casse normale. */
  title?: string;
  /** Légende sous la carte, pour une explication qui n'a pas sa place en ligne. */
  caption?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  caption,
  children,
  className = "",
}: SettingsSectionProps) {
  return (
    <section className={`mb-6 ${className}`}>
      {title ? (
        <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
          {title}
        </h2>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line-subtle bg-surface-1">
        {children}
      </div>

      {caption ? (
        <p className="mt-2 px-1 text-xs leading-5 text-content-tertiary">
          {caption}
        </p>
      ) : null}
    </section>
  );
}
