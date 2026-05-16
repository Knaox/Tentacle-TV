import { useState } from "react";
import type { BackendThemeState } from "../../../../theme";
import {
  TOKEN_CATALOG,
  type TokenCategory,
  type TokenDescriptor,
} from "../../../../theme/tokenCatalog";
import {
  buildTokenPatch,
  getTokenValue,
} from "../../../../theme/tokenUtils";
import { TokenRow } from "./TokenRow";

interface TokenCategorySectionProps {
  state: BackendThemeState;
  category: TokenCategory;
  title: string;
  description: string;
  /** Apply a single-token override. */
  onApply: (path: string, value: string) => void;
  /** Reset a single token to its default value (PUT default, keeping schema simple). */
  onReset: (path: string, defaultValue: string) => void;
  /** Path currently being mutated (for the row spinner). */
  savingPath: string | null;
  defaultOpen?: boolean;
}

export function TokenCategorySection({
  state,
  category,
  title,
  description,
  onApply,
  onReset,
  savingPath,
  defaultOpen = false,
}: TokenCategorySectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const rows: readonly TokenDescriptor[] = TOKEN_CATALOG.filter(
    (t) => t.category === category,
  );
  const overrideCount = rows.reduce((n, token) => {
    const current = getTokenValue(state.tokens, token.defaultValue, token.path);
    return current !== token.defaultValue ? n + 1 : n;
  }, 0);

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <div className="min-w-0">
          <h3 className="text-base font-semibold capitalize text-white">{title}</h3>
          <p className="mt-0.5 truncate text-xs text-white/45">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-white/60">
            {rows.length}
          </span>
          {overrideCount > 0 && (
            <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-light)]">
              {overrideCount} overridden
            </span>
          )}
          <svg
            className={`h-4 w-4 text-white/40 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>

      {open && (
        <div className="space-y-2 border-t border-white/[0.05] p-3">
          {rows.map((token) => {
            const current = getTokenValue(
              state.tokens,
              token.defaultValue,
              token.path,
            );
            return (
              <TokenRow
                key={token.path}
                token={token}
                value={current}
                isOverridden={current !== token.defaultValue}
                saving={savingPath === token.path}
                onApply={(v) => onApply(token.path, v)}
                onReset={() => onReset(token.path, token.defaultValue)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export { buildTokenPatch };
