import type { ReactNode } from "react";
import { PageTransition } from "../../PageTransition";

/**
 * L'en-tête et le cadre de TOUTE page d'administration.
 *
 * Chaque page portait le sien : `text-3xl extrabold` ici, `2xl bold` là,
 * `xl` ailleurs, une page sans titre du tout — et certaines se repaddaient
 * (`px-4 pt-6 pb-16 md:px-12` + `max-w-4xl`) DANS une coquille qui padde déjà.
 * Le cadre est désormais unique : la coquille (`AdminLayout`) fixe les marges
 * et la largeur — pleine largeur sur desktop —, la page n'apporte que son
 * contenu.
 *
 * Même échelle de titre que les réglages (`text-heading-1`, cf.
 * `SettingsShell`) : les deux écrans de configuration se lisent pareil.
 */

export interface AdminPageHeaderProps {
  title: string;
  /** Une phrase qui dit à quoi sert la page. */
  description?: ReactNode;
  /** Pastilles d'état à côté du titre (`StatusPill` : « En direct »…). */
  badges?: ReactNode;
  /** Actions de la page : à droite sur desktop, sous le titre sur mobile. */
  actions?: ReactNode;
  /** Ce qui se lit juste sous la description — un résumé chiffré, par exemple. */
  children?: ReactNode;
}

export function AdminPageHeader({ title, description, badges, actions, children }: AdminPageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      {/* `grow basis-80` : sans base, le bloc mesurait sa largeur maximale —
          768 px avec une description longue — et les actions passaient dessous
          dès 1024 px de large. Elles ne descendent plus que sur téléphone. */}
      <div className="min-w-0 grow basis-80">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-heading-1 tracking-tight text-content-primary">{title}</h1>
          {badges}
        </div>
        {description ? (
          // La page est pleine largeur, pas la phrase : au-delà de ~90 signes
          // par ligne, l'œil perd le fil.
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-content-tertiary">{description}</p>
        ) : null}
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
      {actions ? <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export interface AdminPageProps extends Omit<AdminPageHeaderProps, "children"> {
  /** Sous l'en-tête, avant le contenu (résumé chiffré, onglets…). */
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Une page d'administration : l'en-tête commun, puis le contenu, espacé à un
 * rythme unique. L'entrée (fondu + 12 px) est celle de toutes les pages de
 * l'app — une fois, en `transform` et `opacity` seulement.
 */
export function AdminPage({ summary, children, className, ...header }: AdminPageProps) {
  return (
    <PageTransition className={className}>
      <AdminPageHeader {...header}>{summary}</AdminPageHeader>
      <div className="space-y-6">{children}</div>
    </PageTransition>
  );
}
