import { useId, type ReactNode } from "react";
import { ScopeBadge, type WebSettingScope } from "../../settings/ScopeBadge";

/**
 * La carte de section d'une page d'administration.
 *
 * Titre (h2, sous le h1 de `AdminPage`), phrase d'explication, actions à
 * droite, puis le corps. Remplace les `cls.card` + `h2 text-lg` recopiés de
 * page en page, chacun avec ses marges.
 *
 * `flush` : le corps va bord à bord, pour une liste de lignes séparées par des
 * filets (le modèle de `SettingsRow`) — les filets s'arrêtent au bord de la
 * carte, qui les rogne. `tone="danger"` : zone destructive (réinitialisation,
 * suppression), bordée de rouge.
 *
 * `scope` dit À QUI s'applique ce que la carte règle : « Tout le serveur »
 * (`server`, tous les utilisateurs), « Par compte » (`user`, le compte
 * choisi), « Compte » (`account`, l'administrateur seulement) — la pastille
 * commune des réglages (`ScopeBadge`), à côté du titre. Une carte qui ne fait
 * que montrer un état (compatibilité, guide) n'en porte pas.
 *
 * `id` pose une ancre (`/admin/services#publicurl`) ; `scroll-mt` la garde
 * sous la barre de navigation au lieu de la cacher derrière.
 */

export interface AdminSectionProps {
  title?: string;
  description?: ReactNode;
  /** Actions de la carte (bouton, lien) : à droite du titre. */
  actions?: ReactNode;
  /** Pastilles d'état à côté du titre. */
  badges?: ReactNode;
  /** À qui s'applique ce que la carte règle (pastille de portée). */
  scope?: WebSettingScope;
  /** Ancre de la carte. */
  id?: string;
  tone?: "default" | "danger";
  /** Corps sans marge intérieure, pour des lignes bord à bord. */
  flush?: boolean;
  children?: ReactNode;
  className?: string;
}

export function AdminSection({
  title,
  description,
  actions,
  badges,
  scope,
  id,
  tone = "default",
  flush = false,
  children,
  className,
}: AdminSectionProps) {
  const headingId = useId();
  const hasHeader = Boolean(title || description || actions || badges || scope);

  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      // `overflow-hidden` en mode `flush` SEULEMENT : il rogne les filets et
      // les survols des lignes dans l'arrondi, mais couperait aussi un menu
      // déroulant (`Dropdown` est positionné en absolu, sans portail).
      className={`scroll-mt-24 rounded-2xl border bg-fill-faint ${flush ? "overflow-hidden" : ""} ${
        tone === "danger" ? "border-danger-border" : "border-line-subtle"
      } ${className ?? ""}`}
    >
      {hasHeader ? (
        // Une rangée qui se replie : une action courte reste à droite du titre
        // même sur téléphone, une longue passe dessous.
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5">
          {/* Base de 12 rem : une action courte tient à droite même à 390 px. */}
          <div className="min-w-0 grow basis-48">
            {title || badges || scope ? (
              <div className="flex flex-wrap items-center gap-2">
                {title ? (
                  <h2
                    id={headingId}
                    className={`text-base font-semibold ${tone === "danger" ? "text-status-error-fg" : "text-content-primary"}`}
                  >
                    {title}
                  </h2>
                ) : null}
                {scope ? <ScopeBadge scope={scope} /> : null}
                {badges}
              </div>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-content-tertiary">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children !== undefined && children !== null ? (
        <div className={flush ? (hasHeader ? "mt-4 border-t border-line-subtle" : "") : hasHeader ? "px-5 pb-5 pt-4" : "p-5"}>
          {children}
        </div>
      ) : hasHeader ? (
        <div className="pb-5" />
      ) : null}
    </section>
  );
}
