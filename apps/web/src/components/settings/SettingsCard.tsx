import { SettingsSection, type SettingsSectionProps } from "@tentacle-tv/ui";
import { useWideSettings } from "./wide/wideSettingsMeta";

/**
 * Le groupe d'un écran de réglages qui porte SES titres (la Famille, « Qui regarde ? » à
 * l'ouverture) plutôt que ceux du catalogue. Dans les réglages du web large, il prend la forme
 * des groupes du catalogue (`WideGroup` : un titre dans la police des titres, sa pastille, un
 * panneau) — une rubrique ne doit pas ressembler à une autre application que sa voisine.
 * Ailleurs (le miroir de l'app mobile, où ces mêmes écrans sont montés), le groupe d'avant
 * (`SettingsSection`), inchangé.
 */
export function SettingsCard({ title, caption, badge, id, children, className = "" }: SettingsSectionProps) {
  const wide = useWideSettings() !== null;
  if (!wide) return <SettingsSection title={title} caption={caption} badge={badge} id={id} className={className}>{children}</SettingsSection>;
  return (
    <section id={id} className={`mb-9 scroll-mt-24 ${className}`}>
      {title ? (
        <header className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1">
          <h2 className="text-heading-3 text-content-primary">{title}</h2>
          {badge ?? null}
        </header>
      ) : null}
      <div className="lg-content ui-panel overflow-hidden">{children}</div>
      {caption ? <p className="mt-2 max-w-[70ch] px-1 text-xs leading-5 text-content-tertiary">{caption}</p> : null}
    </section>
  );
}
