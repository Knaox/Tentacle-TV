import { memo, useMemo } from "react";

/**
 * Les Overview Jellyfin (métadonnées TMDB/scrapers) contiennent parfois du
 * HTML léger — « <br>Source: crunchyroll », <b>, <i>… — affiché brut par JSX.
 * Ici : rendu interprété mais STRICTEMENT assaini (whitelist minuscule, zéro
 * attribut conservé → script/onerror/style/href neutralisés). Zéro dépendance.
 */

// Balises conservées telles quelles (sans aucun attribut). Tout le reste est
// « déballé » : la balise disparaît, son contenu texte reste.
const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "BR"]);

/** Overview → HTML sûr : whitelist b/strong/i/em/br, aucun attribut. */
export function sanitizeOverviewHtml(raw: string): string {
  // DOMParser n'exécute rien au parse (pas de scripts, pas de chargements).
  const doc = new DOMParser().parseFromString(raw, "text/html");
  const out = doc.createElement("div");
  const copy = (from: Node, to: Element) => {
    for (const child of Array.from(from.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        to.appendChild(doc.createTextNode(child.textContent ?? ""));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        if (ALLOWED_TAGS.has(el.tagName)) {
          const clone = doc.createElement(el.tagName.toLowerCase());
          to.appendChild(clone);
          copy(el, clone);
        } else {
          copy(el, to);
        }
      }
      // Commentaires et autres nœuds : ignorés.
    }
  };
  copy(doc.body, out);
  return out.innerHTML;
}

/** Overview → texte brut d'une seule ligne (aperçus tronqués par .slice() :
 *  couper du HTML brut sectionnerait une balise). <br> → espace. */
export function stripOverviewHtml(raw: string): string {
  if (!/[<&]/.test(raw)) return raw;
  const doc = new DOMParser().parseFromString(raw.replace(/<br\s*\/?>/gi, " "), "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Rendu inline d'un Overview : gras/italique/retours interprétés, le reste
 *  neutralisé. <span> → s'insère dans les <p> clampés existants (line-clamp
 *  fonctionne avec du contenu inline ; un <br> consomme une ligne du clamp).
 *  Fast-path texte pur (ni « < » ni « & ») sans DOMParser. */
export const RichOverview = memo(function RichOverview({
  text, className,
}: {
  text: string;
  className?: string;
}) {
  const html = useMemo(() => (/[<&]/.test(text) ? sanitizeOverviewHtml(text) : null), [text]);
  if (html == null) return <span className={className}>{text}</span>;
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});
