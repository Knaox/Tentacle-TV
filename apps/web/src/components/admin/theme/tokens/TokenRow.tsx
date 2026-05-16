import { useEffect, useState } from "react";
import type { TokenDescriptor } from "../../../../theme/tokenCatalog";

interface TokenRowProps {
  token: TokenDescriptor;
  /** Current resolved value (override-or-default). */
  value: string;
  /** True when the token's value differs from the default. */
  isOverridden: boolean;
  saving: boolean;
  onApply: (value: string) => void;
  onReset: () => void;
}

/**
 * One token = one row. Editor input picked from `token.type`. The local
 * draft state is debounced — the parent's `onApply` is called 350 ms after
 * the user stops typing, avoiding a backend write per keystroke.
 */
export function TokenRow({
  token,
  value,
  isOverridden,
  saving,
  onApply,
  onReset,
}: TokenRowProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === value) return;
    const id = setTimeout(() => onApply(draft), 350);
    return () => clearTimeout(id);
  }, [draft, value, onApply]);

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">
            {token.label}
          </span>
          {isOverridden && (
            <span className="rounded-sm bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--brand-light)]">
              Overridden
            </span>
          )}
        </div>
        <code className="mt-0.5 block truncate text-[11px] text-white/40">
          {token.cssVar ?? token.path}
        </code>
      </div>

      <div className="col-span-2 sm:col-span-1">
        <TokenEditor token={token} value={draft} onChange={setDraft} />
        <p className="mt-1 truncate font-mono text-[10px] text-white/30">
          default: {token.defaultValue}
        </p>
      </div>

      <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
        {saving && <span className="text-[10px] text-white/50">…</span>}
        <button
          type="button"
          onClick={onReset}
          disabled={!isOverridden || saving}
          className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/50 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function TokenEditor({
  token,
  value,
  onChange,
}: {
  token: TokenDescriptor;
  value: string;
  onChange: (next: string) => void;
}) {
  const sharedInput =
    "h-9 w-full rounded-md bg-white/[0.06] border border-white/[0.08] px-2 text-xs text-white outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.3)]";

  if (token.type === "color") {
    return (
      <div className="flex gap-2">
        <input
          type="color"
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded-md border border-white/[0.08] bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${sharedInput} font-mono uppercase`}
          spellCheck={false}
        />
      </div>
    );
  }

  if (token.type === "multi-shadow") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className={`${sharedInput} h-auto resize-y py-2 font-mono`}
        spellCheck={false}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${sharedInput} font-mono`}
      spellCheck={false}
      placeholder={token.defaultValue}
    />
  );
}
