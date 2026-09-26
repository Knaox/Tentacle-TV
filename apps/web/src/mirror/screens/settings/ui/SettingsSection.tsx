import type { ReactNode } from "react";

/**
 * `SettingsSection` de l'app : titre 13 semibold en capitales (tertiaire,
 * espacement 0,3, marge basse 8, retrait 4), carte `surface.s1` rayon 12 avec
 * filet, légende 11 sous la carte ; 20 sous la section.
 */
export function SettingsSection({ title, caption, children }: {
  title?: string;
  caption?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-5">
      {title ? (
        <h2 className="mb-2 ml-1 text-[13px] font-semibold uppercase tracking-[0.3px] text-content-tertiary">{title}</h2>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-line-subtle bg-surface-1">{children}</div>
      {caption ? (
        <p className="ml-1 mt-2 text-[11px] font-semibold leading-[17px] text-content-tertiary">{caption}</p>
      ) : null}
    </section>
  );
}
