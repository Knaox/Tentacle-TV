import { useTranslation } from "react-i18next";
import { HighlightedText } from "../../../components/search/HighlightedText";
import { isAppleKeyboard } from "../../../lib/shortcutLabel";
import type { ScenePoster } from "../../sceneMedia";
import { CARD_TONES, Place, type Placed } from "..";

/**
 * L'omnibox, en faux : l'anatomie de `components/search/omnibox` — le champ,
 * la ligne « Résultats pour … », le MEILLEUR RÉSULTAT, « Tous les résultats »
 * et le pied de raccourcis avec le temps du moteur — aux mesures du canevas.
 * Le squelette est statique, comme dans l'app.
 */

interface FauxOmniboxProps extends Placed {
  typed: string;
  /** Ce que le moteur a compris à la place ; `null` : rien à corriger. */
  corrected: string | null;
  terms: readonly string[];
  hit: ScenePoster | null;
  /** La réponse est là : le squelette cède la place au résultat. */
  answered: boolean;
}

const BODY_TOP = 52;
const FOOTER_H = 32;

function SearchGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" strokeLinecap="round" />
    </svg>
  );
}

function Hint({ keys, label }: { keys: readonly string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key) => (
        <kbd key={key} className="min-w-[15px] rounded border border-line-subtle bg-fill-subtle px-1 text-center text-[9px] leading-[14px] text-content-tertiary">
          {key}
        </kbd>
      ))}
      {label}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-1.5 p-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-0.5">
          <span className="h-[38px] w-[26px] rounded-md bg-fill-soft" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-2.5 rounded bg-fill-soft" style={{ width: `${60 - i * 12}%` }} />
            <span className="h-2 w-1/3 rounded bg-fill-subtle" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function FauxOmnibox({ typed, corrected, terms, hit, answered, w = 500, h = 262, ...place }: FauxOmniboxProps) {
  const { t } = useTranslation("search");
  const empty = typed === "";
  const caret = <span className="inline-block h-[17px] w-px translate-y-[3px] bg-content-primary" />;
  const bodyH = h - BODY_TOP - FOOTER_H;
  return (
    <Place {...place} w={w} h={h}>
      <div className="relative h-full overflow-hidden rounded-[18px] border border-line-subtle bg-surface-modal" style={{ boxShadow: "var(--shadow-modal)" }}>
        <div className="flex items-center gap-2.5 border-b border-line-subtle px-4" style={{ height: BODY_TOP }}>
          <SearchGlyph className="h-[18px] w-[18px] shrink-0 text-[var(--brand-light)]" />
          <p className="min-w-0 flex-1 truncate whitespace-pre text-[15px] leading-6">
            {empty ? <>{caret}<span className="text-content-tertiary">{t("placeholder")}</span></> : <span className="text-content-primary">{typed}{caret}</span>}
          </p>
        </div>

        <Place x={0} y={BODY_TOP} w={w} h={bodyH} visible={empty} className="flex flex-col items-center justify-center px-10 text-center">
          <p className="text-[14px] font-semibold text-content-primary">{t("emptyTitle")}</p>
          <p className="mt-1.5 text-[11px] leading-snug text-content-tertiary">{t("emptyHint")}</p>
        </Place>
        <Place x={0} y={BODY_TOP} w={w} visible={!empty && !answered}>
          <Skeleton />
        </Place>
        <Place x={0} y={BODY_TOP} w={w} visible={answered} className="flex flex-col gap-2 p-3">
          {corrected !== null && (
            <p className="px-1 text-[12px] text-content-tertiary">
              {t("resultsFor")} <span className="font-semibold italic text-[var(--brand-light)]">{corrected}</span>
            </p>
          )}
          <div className="flex items-center gap-3 rounded-2xl border border-[rgba(var(--brand-rgb),0.4)] bg-fill-soft p-2.5">
            <div className="h-[72px] w-12 shrink-0 overflow-hidden rounded-lg" style={{ background: CARD_TONES[0], boxShadow: "var(--elev-1)" }}>
              {hit && <img src={hit.url} alt="" draggable={false} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold tracking-tight text-content-primary">
                <HighlightedText text={hit?.title ?? corrected ?? typed} terms={terms} />
              </p>
              {hit?.year != null && <p className="mt-0.5 text-[11px] text-content-tertiary">{hit.year}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-content-secondary">
            <SearchGlyph className="h-3.5 w-3.5 shrink-0 text-content-tertiary" />
            <span className="truncate">{t("allResults", { query: corrected ?? typed })}</span>
          </div>
        </Place>

        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-line-subtle px-4 text-[10px] text-content-quaternary" style={{ height: FOOTER_H }}>
          <Hint keys={["↑", "↓"]} label={t("hintNavigate")} />
          <Hint keys={["↵"]} label={t("hintOpen")} />
          {!empty && <Hint keys={[isAppleKeyboard() ? "⌘" : "Ctrl", "↵"]} label={t("hintAllResults")} />}
          <span className="ml-auto tabular-nums">{answered ? t("foundIn", { ms: 3 }) : ""}</span>
        </div>
      </div>
    </Place>
  );
}
