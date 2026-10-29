/**
 * Octave — le choix de ce qu'on importe (« Lien ou liste », « Un album », « Fichiers ») : un contrôle segmenté,
 * des onglets au clavier (flèches gauche / droite). Une voie que le serveur ne sait pas prendre n'est pas offerte ;
 * une seule voie : pas de contrôle du tout.
 */

import { useRef } from "react";
import { useTranslation } from "react-i18next";

export type ImportMode = "link" | "album" | "files";

interface Props {
  modes: readonly ImportMode[];
  value: ImportMode;
  onChange: (mode: ImportMode) => void;
}

export function ImportModeTabs({ modes, value, onChange }: Props) {
  const { t } = useTranslation("musicImport");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  if (modes.length < 2) return null;
  const move = (step: number) => {
    const at = (modes.indexOf(value) + step + modes.length) % modes.length;
    const next = modes[at];
    if (!next) return;
    onChange(next);
    refs.current[at]?.focus();
  };
  return (
    <div role="tablist" aria-label={t("mode.label")} className="flex rounded-full border border-line-subtle bg-fill-subtle p-1">
      {modes.map((mode, i) => {
        const selected = mode === value;
        return (
          <button
            key={mode}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(mode)}
            onKeyDown={(e) => {
              const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (step === 0) return;
              e.preventDefault();
              move(step);
            }}
            className={`min-h-[36px] flex-1 cursor-pointer rounded-full px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${selected ? "bg-octave-hover text-content-primary" : "text-content-tertiary hover:text-content-primary"}`}
          >
            {t(`mode.${mode}`)}
          </button>
        );
      })}
    </div>
  );
}
