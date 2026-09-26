import { Fragment, memo, useMemo } from "react";
import { changelogFor, parseChangelog, type ChangelogBlock, type ChangelogSpan } from "./changelog";

/**
 * Les notes de version d'un plugin, dans la langue de l'administrateur :
 * titres, puces (sur deux niveaux), gras et code — rendus en éléments React,
 * jamais en HTML (le texte vient d'un registre, parfois tiers).
 */
export const ChangelogView = memo(function ChangelogView({ text, language }: { text: string; language: string }) {
  const groups = useMemo(() => group(parseChangelog(changelogFor(text, language))), [text, language]);
  if (groups.length === 0) return null;
  return (
    <div className="space-y-3 text-sm leading-relaxed text-content-secondary">
      {groups.map((item, index) =>
        Array.isArray(item) ? (
          <ul key={index} className="list-disc space-y-1.5 pl-5 marker:text-content-quaternary">
            {item.map((entry, i) => (
              <li key={i} className={entry.depth > 0 ? "ml-4 list-[circle]" : ""}>
                <Spans spans={entry.spans} />
              </li>
            ))}
          </ul>
        ) : item.kind === "heading" ? (
          <p key={index} className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
            <Spans spans={item.spans} />
          </p>
        ) : (
          <p key={index}>
            <Spans spans={item.spans} />
          </p>
        ),
      )}
    </div>
  );
});

type ItemBlock = Extract<ChangelogBlock, { kind: "item" }>;

/** Les puces consécutives forment une liste ; le reste passe tel quel. */
function group(blocks: ChangelogBlock[]): Array<ItemBlock[] | Exclude<ChangelogBlock, ItemBlock>> {
  const out: Array<ItemBlock[] | Exclude<ChangelogBlock, ItemBlock>> = [];
  for (const block of blocks) {
    if (block.kind === "item") {
      const last = out[out.length - 1];
      if (Array.isArray(last)) last.push(block);
      else out.push([block]);
    } else {
      out.push(block);
    }
  }
  return out;
}

function Spans({ spans }: { spans: ChangelogSpan[] }) {
  return (
    <>
      {spans.map((span, i) =>
        span.strong ? (
          <strong key={i} className="font-semibold text-content-primary">{span.text}</strong>
        ) : span.code ? (
          <code key={i} className="rounded bg-fill-soft px-1 font-mono text-[12px]">{span.text}</code>
        ) : (
          <Fragment key={i}>{span.text}</Fragment>
        ),
      )}
    </>
  );
}
