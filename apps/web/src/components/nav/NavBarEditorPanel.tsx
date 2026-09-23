/**
 * « Personnaliser la barre » — le mode édition de la barre desktop.
 *
 * Deux listes : ce qui est DANS la barre, dans son ordre (glisser par la
 * poignée, ou ↑ ↓), et ce qui n'y est pas — qui reste dans « Plus ». Toute
 * destination se retire, bibliothèques comprises, et s'épingle d'un geste.
 *
 * Aucun « Enregistrer » : chaque geste s'applique à la vraie barre, visible
 * juste au-dessus — on voit le résultat en le faisant. « Réinitialiser »
 * rend la barre d'origine.
 *
 * Pendant le glisser, l'ordre vit en local (`draft`) et ne s'écrit qu'au
 * lâcher : la barre ne se réarrange pas à chaque ligne survolée.
 *
 * Fond OPAQUE (`--nav-panel-bg`), sans `backdrop-filter` — même règle que
 * le panneau « Plus ». Échap, « Terminé » et un clic dehors le ferment ; le
 * focus revient au bouton qui l'a ouvert.
 */

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { Reorder, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { easeOut } from "../../theme/motion";
import { PinnedRow, ShelfRow } from "./NavBarEditorRow";
import type { NavBarEditor, NavEntry } from "./useNavDestinations";

interface NavBarEditorPanelProps {
  entries: readonly NavEntry[];
  editor: NavBarEditor;
  trigger: RefObject<HTMLElement | null>;
  onClose: () => void;
}

function SectionTitle({ children }: { children: string }) {
  return <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">{children}</p>;
}

export function NavBarEditorPanel({ entries, editor, trigger, onClose }: NavBarEditorPanelProps) {
  const { t } = useTranslation("nav");
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const pinned = entries.filter((e) => e.pinned);
  const shelf = entries.filter((e) => !e.pinned);
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const pinnedKeys = pinned.map((e) => e.key);

  // L'ordre pendant le glisser ; `null` hors glisser — c'est alors la barre qui fait foi.
  const [draft, setDraft] = useState<string[] | null>(null);
  const order = draft ?? pinnedKeys;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const commitDrag = useCallback(() => {
    if (draftRef.current !== null) editor.reorder(draftRef.current);
    setDraft(null);
  }, [editor]);

  const close = useCallback(() => {
    onClose();
    trigger.current?.focus();
  }, [onClose, trigger]);

  // Le focus entre dans le panneau à l'ouverture — une seule fois : le
  // reprendre à chaque rendu l'arracherait au bouton ↑ qu'on vient d'utiliser.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || trigger.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [close, onClose, trigger]);

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="absolute left-0 top-[calc(100%+14px)] z-50 flex max-h-[calc(100vh-120px)] w-[min(460px,calc(100vw-32px))] flex-col rounded-2xl border border-line-subtle bg-[color:var(--nav-panel-bg)] shadow-[var(--shadow-dropdown)] outline-none"
      initial={reduced ? false : { opacity: 0, y: -6, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: easeOut }}
    >
      <header className="border-b border-line-subtle px-5 pb-3 pt-4">
        <h2 id={titleId} className="text-base font-semibold text-content-primary">{t("customizeBar")}</h2>
        <p className="mt-0.5 text-[13px] leading-relaxed text-content-tertiary">{t("customizeBarHint")}</p>
      </header>

      <motion.div layoutScroll className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <section>
          <SectionTitle>{t("inTheBar")}</SectionTitle>
          {order.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-subtle px-3 py-3 text-[13px] text-content-tertiary">{t("barEmpty")}</p>
          ) : (
            <Reorder.Group as="ul" axis="y" values={order} onReorder={setDraft} className="space-y-1.5">
              {order.map((key, index) => {
                const entry = byKey.get(key);
                if (!entry) return null;
                return (
                  <PinnedRow
                    key={key}
                    entry={entry}
                    first={index === 0}
                    last={index === order.length - 1}
                    onNudge={editor.nudge}
                    onUnpin={editor.unpin}
                    onDragEnd={commitDrag}
                  />
                );
              })}
            </Reorder.Group>
          )}
        </section>

        {shelf.length > 0 && (
          <section className="mt-4">
            <SectionTitle>{t("inMore")}</SectionTitle>
            <ul className="space-y-0.5">
              {shelf.map((entry) => <ShelfRow key={entry.key} entry={entry} onPin={editor.pin} />)}
            </ul>
          </section>
        )}
      </motion.div>

      <footer className="flex items-center justify-between gap-2 border-t border-line-subtle px-4 py-3">
        <button
          type="button"
          onClick={editor.reset}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-content-tertiary outline-none transition-colors hover:bg-fill-subtle hover:text-content-primary focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <RotateCcw aria-hidden className="h-3.5 w-3.5" />
          {t("resetBar")}
        </button>
        <button
          type="button"
          onClick={close}
          className="inline-flex h-9 items-center rounded-full border border-cta-primary-border bg-cta-primary-bg px-5 text-[13px] font-bold text-cta-primary-fg outline-none transition-[background-color,transform] hover:bg-cta-primary-bg-hover active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {t("done")}
        </button>
      </footer>
    </motion.div>
  );
}
