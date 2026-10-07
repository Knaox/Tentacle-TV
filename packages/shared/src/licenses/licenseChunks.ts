import type { ThirdPartyComponent } from "./licenseTypes";

/**
 * Un texte de licence découpé en blocs de paragraphes entiers, chacun d'au
 * plus `maxChars` caractères (sauf un paragraphe plus long, laissé entier).
 * Sur un téléviseur, on lit un texte long en passant de bloc en bloc : chaque
 * bloc est une cible de focus que le défilement suit.
 */
export function splitLicenseText(text: string, maxChars = 900): string[] {
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((p) => p.trimEnd()).filter((p) => p.trim() !== "");
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (current && next.length > maxChars) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Un composant tiers en un bloc de texte : nom, version, licence, mentions, source. */
export function componentBlock(c: ThirdPartyComponent): string {
  return [
    c.version ? `${c.name} ${c.version}` : c.name,
    c.license,
    c.notice,
    c.note,
    c.source,
  ].filter(Boolean).join("\n");
}
