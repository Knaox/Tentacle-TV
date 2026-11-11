import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { useState } from "react";
import type { DebugSection } from "../playerDebugTypes";

const tone = (state: boolean | null): string => (state === null ? "" : state ? "dbg-good" : "dbg-bad");

/** Les sections repliées, retenues d'une ouverture à l'autre (par titre). */
const FOLDED_KEY = "tentacle_debug_sections_pliees";

function loadFolded(): Set<string> {
  try {
    const raw = localStorage.getItem(FOLDED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * L'onglet « Diagnostic » : le VERDICT d'abord (des phrases, sur toute la largeur), puis les
 * relevés par section — repliables, parce qu'on n'en regarde qu'une ou deux à la fois.
 */
export function DebugDiagnosticView({ sections }: { sections: readonly DebugSection[] }) {
  const [folded, setFolded] = useState(loadFolded);

  const toggle = (title: string) => {
    setFolded((previous) => {
      const next = new Set(previous);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      try {
        localStorage.setItem(FOLDED_KEY, JSON.stringify([...next]));
      } catch {
        /* stockage indisponible : le pli vaut pour cette ouverture */
      }
      return next;
    });
  };

  return (
    <>
      {sections.map((section) => {
        if (section.emphasis) {
          return (
            <div key={section.title} className="dbg-verdict" role="group" aria-label={section.title}>
              {section.lines.map(([key, value, state]) => (
                <div key={key} className="dbg-verdict__line">
                  <span className="dbg-verdict__key">{key}</span>
                  <span className={`dbg-verdict__value ${tone(state)}`}>{value}</span>
                </div>
              ))}
            </div>
          );
        }
        const open = !folded.has(section.title);
        const bad = section.lines.filter(([, , state]) => state === false).length;
        return (
          <div key={section.title} className="dbg-section" data-open={open}>
            <button type="button" className="dbg-section__head" aria-expanded={open} onClick={() => toggle(section.title)}>
              <CaretDownIcon className="dbg-section__caret" size={11} weight="bold" aria-hidden />
              <span>{section.title}</span>
              {/* Repliée, une section dit quand même qu'elle porte un défaut. */}
              {!open && <span className={`dbg-section__count ${bad > 0 ? "dbg-bad" : ""}`}>{bad > 0 ? `${bad} à voir` : section.lines.length}</span>}
            </button>
            {open && (
              <div className="dbg-lines">
                {section.lines.map(([key, value, state]) => (
                  <div key={key} className="dbg-line">
                    <span className="dbg-line__key">{key}</span>
                    <span className={`dbg-line__value ${tone(state)}`} title={value}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
