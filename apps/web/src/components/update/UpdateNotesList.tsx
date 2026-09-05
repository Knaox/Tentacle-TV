import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UpdateNote } from "./updateNotes";

interface UpdateNotesListProps {
  notes: UpdateNote[];
  /** Id de la section, pour l'`aria-describedby` de la modale. */
  id?: string;
}

/**
 * Les notes de la version qui arrive, bornées en hauteur. Le fondu du bas ne
 * s'affiche que si la liste déborde ET qu'on n'est pas au bout : c'est un
 * signal, pas un décor.
 */
export function UpdateNotesList({ notes, id }: UpdateNotesListProps) {
  const { t } = useTranslation("notifications");
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setOverflowing(el.scrollHeight - el.clientHeight - el.scrollTop > 4);
  }, []);

  useEffect(() => {
    measure();
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, notes]);

  if (notes.length === 0) return null;

  const titleId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={titleId}>
      <p id={titleId} className="mb-2 text-xs font-medium uppercase tracking-wider text-content-quaternary">
        {t("notifications:updateReleaseNotes")}
      </p>
      <div className="relative">
        <ul ref={scrollerRef} onScroll={measure} className="max-h-56 space-y-2.5 overflow-y-auto pr-2">
          {notes.map((note, i) => (
            <li key={i} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)]"
              />
              <p className="text-sm leading-relaxed text-content-tertiary">
                {note.title && (
                  <>
                    <span className="font-semibold text-content-primary">{note.title}</span>
                    <span className="text-content-quaternary"> — </span>
                  </>
                )}
                {note.body}
              </p>
            </li>
          ))}
        </ul>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-modal to-transparent"
          style={{ opacity: overflowing ? 1 : 0, transition: "opacity var(--duration-base) var(--ease-out)" }}
        />
      </div>
    </section>
  );
}
