import { useEffect } from "react";

interface WhatsNewKeysOptions {
  index: number;
  count: number;
  go: (index: number) => void;
}

/** ← / → / Début / Fin naviguent entre les nouveautés ; jamais depuis un champ de saisie. */
export function useWhatsNewKeys({ index, count, go }: WhatsNewKeysOptions): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const next =
        e.key === "ArrowRight" ? index + 1
        : e.key === "ArrowLeft" ? index - 1
        : e.key === "Home" ? 0
        : e.key === "End" ? count - 1
        : null;
      if (next === null) return;
      e.preventDefault();
      go(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, go]);
}
