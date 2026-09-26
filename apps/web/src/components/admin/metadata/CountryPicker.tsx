import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { cls } from "../../../pages/adminUtils";
import { CountryFlag } from "./CountryFlag";
import { useCountryFlags } from "./countryFlags";
import { filterCountryOptions, type CountryOption } from "./countryOptions";

interface CountryPickerProps {
  value: string;
  options: readonly CountryOption[];
  onChange: (code: string) => void;
  /** L'étiquette visible du champ (« Pays »), qui nomme aussi la liste. */
  labelId: string;
  /** Sous la liste : pourquoi certains pays n'y sont pas. */
  footnote?: string;
  disabled?: boolean;
}

/** Saut de Page ↑ / Page ↓, en options. */
const PAGE = 8;

/**
 * Le choix d'un pays : drapeau, nom dans la langue de l'interface, recherche.
 * Remplaçait un champ de deux lettres où il fallait connaître « GB » pour le
 * Royaume-Uni. Motif ARIA « combobox » : le bouton ouvre la liste, la
 * recherche garde le focus et désigne l'option active (`aria-activedescendant`)
 * — flèches, Page ↑/↓, Entrée pour choisir, Échap pour effacer puis fermer.
 * Pas de sortie animée : un sélecteur se referme net, et deux listes ne
 * coexistent jamais le temps d'un fondu.
 */
export function CountryPicker({ value, options, onChange, labelId, footnote, disabled }: CountryPickerProps) {
  const { t } = useTranslation("adminMetadata");
  const flags = useCountryFlags();
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const triggerId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => filterCountryOptions(options, query), [options, query]);
  const selected = options.find((o) => o.code === value);
  const activeCode = filtered[active]?.code;
  const selectedIndex = Math.max(0, options.findIndex((o) => o.code === value));

  const openList = () => {
    setQuery("");
    setActive(selectedIndex);
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const choose = (code: string) => {
    onChange(code);
    close(true);
  };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    // Un clic hors du sélecteur le referme ; le focus reste où l'on a cliqué.
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // L'option active reste visible, au clavier comme à l'ouverture.
  useEffect(() => {
    if (open && activeCode) document.getElementById(`${listId}-${activeCode}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeCode, listId]);

  const move = (to: number) => setActive(Math.min(Math.max(to, 0), Math.max(filtered.length - 1, 0)));

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(active + 1),
      ArrowUp: () => move(active - 1),
      PageDown: () => move(active + PAGE),
      PageUp: () => move(active - PAGE),
      Enter: () => activeCode && choose(activeCode),
      Escape: () => {
        if (!query) return close(true);
        setQuery("");
        setActive(selectedIndex);
      },
    };
    if (event.key === "Tab") setOpen(false);
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${triggerId}`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openList();
          }
        }}
        className={`${cls.inp} flex cursor-pointer items-center gap-3 text-left hover:bg-fill-soft disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <CountryFlag code={value} flags={flags} />
        <span className="min-w-0 flex-1 truncate">{selected?.name ?? value}</span>
        <span className="font-mono text-xs text-content-tertiary">{value}</span>
        <ChevronDown
          aria-hidden
          size={16}
          className={`shrink-0 text-content-tertiary transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          // Fond à 95 % d'opacité : un flou d'arrière-plan n'y verrait rien.
          className="absolute inset-x-0 top-full z-50 mt-2 origin-top overflow-hidden rounded-xl border border-line-subtle bg-surface-dropdown"
          style={{ boxShadow: "var(--shadow-dropdown)" }}
        >
          <div className="relative border-b border-line-subtle p-2">
            <Search aria-hidden size={16} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-content-tertiary" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeCode ? `${listId}-${activeCode}` : undefined}
              aria-label={t("regionSearch")}
              placeholder={t("regionSearch")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKeyDown}
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full rounded-lg border border-line-subtle bg-fill-subtle pl-9 pr-3 text-sm text-content-primary outline-none placeholder:text-content-quaternary focus:border-[var(--brand)]"
            />
          </div>
          <ul id={listId} role="listbox" aria-labelledby={labelId} className="max-h-72 overflow-y-auto overscroll-contain py-1">
            {filtered.map((option, index) => {
              const isSelected = option.code === value;
              return (
                <li
                  key={option.code}
                  id={`${listId}-${option.code}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-label={
                    option.providers === null
                      ? option.name
                      : `${option.name}, ${t("regionOptionProviders", { count: option.providers })}`
                  }
                  // Le focus reste dans la recherche : le clic ne le lui prend pas.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option.code)}
                  onMouseMove={() => index !== active && setActive(index)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${index === active ? "bg-fill-soft" : ""} ${
                    isSelected ? "font-medium text-content-primary" : "text-content-secondary"
                  }`}
                >
                  <CountryFlag code={option.code} flags={flags} />
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  {option.providers !== null && (
                    <span className="text-xs tabular-nums text-content-quaternary">{option.providers}</span>
                  )}
                  <span className="flex w-4 shrink-0 justify-center">
                    {isSelected && <Check aria-hidden size={16} className="text-brand-light" />}
                  </span>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 && (
            <p role="status" className="px-3 pb-5 pt-4 text-center text-sm text-content-tertiary">
              {t("regionNoMatch")}
            </p>
          )}
          {footnote && <p className="border-t border-line-subtle px-3 py-2 text-xs text-content-tertiary">{footnote}</p>}
        </motion.div>
      )}
    </div>
  );
}
