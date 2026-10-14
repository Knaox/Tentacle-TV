import { useId, type ReactNode } from "react";

/** Une section de la galerie : son titre, puis ses tuiles sur une grille qui se replie. */
export function GallerySection({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mb-4">
      <h3 id={headingId} className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-content-quaternary">
        {title}
      </h3>
      <div role="group" aria-labelledby={headingId} className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] justify-items-center gap-x-1 gap-y-1">
        {children}
      </div>
    </section>
  );
}
