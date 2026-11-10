import { memo, useMemo } from "react";
import { highlightRanges } from "@tentacle-tv/shared";

/**
 * Un texte dont les débuts de mots tapés ressortent — plié comme l'index du
 * serveur (`searchHighlight.ts`) : « pokem » fait ressortir « Poké » de
 * « Pokémon ». Le reste du texte est un ton plus bas, pour que l'œil trouve
 * d'abord ce qu'il a cherché.
 */
export const HighlightedText = memo(function HighlightedText({
  text,
  terms,
  plain = false,
}: {
  text: string;
  terms: readonly string[];
  /**
   * Dans un grand titre (ou sur une image) : le mot trouvé garde la couleur et
   * la graisse de sa ligne — un titre en graisse de titrage n'a pas à
   * s'alléger là où il répond, ni à quitter sa couleur « sur média ».
   */
  plain?: boolean;
}) {
  const parts = useMemo(() => {
    const ranges = highlightRanges(text, terms);
    const out: Array<{ text: string; hit: boolean }> = [];
    let cursor = 0;
    for (const [start, end] of ranges) {
      if (start > cursor) out.push({ text: text.slice(cursor, start), hit: false });
      out.push({ text: text.slice(start, end), hit: true });
      cursor = end;
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor), hit: false });
    return out;
  }, [text, terms]);

  return (
    <>
      {parts.map((part, i) =>
        part.hit ? (
          <mark key={i} className={plain ? "bg-transparent text-inherit [font-weight:inherit]" : "bg-transparent font-semibold text-content-primary"}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
});
