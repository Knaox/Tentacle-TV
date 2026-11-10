import type { ReactNode } from "react";

/** Une section du labo : son titre (police des titres), une phrase, puis ses spécimens. */
export function LabSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-heading-2 text-content-primary">{title}</h2>
        {note ? <p className="max-w-[65ch] text-sm text-content-tertiary">{note}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** Un spécimen : ce qu'on montre, et son nom (classe, jeton ou composant) dessous. */
export function Specimen({ name, children, className }: { name: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-start gap-2 ${className ?? ""}`}>
      {children}
      <code className="text-[11px] text-content-quaternary">{name}</code>
    </div>
  );
}

/** Une rangée de spécimens, qui passe à la ligne. */
export function LabRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-x-6 gap-y-5">{children}</div>;
}

/** Un panneau du socle, pour poser des spécimens sur l'encre de panneau. */
export function LabPanel({ children }: { children: ReactNode }) {
  return <div className="ui-panel flex flex-col gap-5 p-6">{children}</div>;
}
