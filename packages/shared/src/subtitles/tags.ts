/**
 * Tokenizer du texte d'une cue de sous-titre (WebVTT servi par Jellyfin).
 *
 * Jellyfin convertit les pistes SRT/ASS en WebVTT côté serveur mais laisse
 * fuiter le balisage source tel quel dans le texte des cues :
 *  - balises HTML des SRT (<i>, <b>, <font color=…>) ;
 *  - tags override ASS entre accolades ({\an8}, {\i1}, {\pos(960,80)}…).
 *
 * Ici on INTERPRÈTE ce qui a un sens à l'écran — gras / italique / souligné
 * et ancrage vertical ({\an7-9} → haut, {\an4-6} → milieu) — et on strippe
 * proprement tout le reste (couleurs, positionnement pixel, karaoké, fades…) :
 * rien ne doit jamais s'afficher en « code brut ».
 */

export interface SubtitleSegment {
  text: string;
  /** Flags posés uniquement si actifs (objets compacts, comparaison simple). */
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** Ancrage vertical d'une cue à l'écran (ASS \an/\a ou cue setting VTT line:%). */
export type SubtitleAnchor = "top" | "middle" | "bottom";

export interface TokenizedCueText {
  /** Lignes affichées, chacune découpée en segments de style homogène. */
  lines: SubtitleSegment[][];
  /** Ancrage demandé par un tag {\anX}/{\aX} ; undefined = pas d'override. */
  anchor?: SubtitleAnchor;
}

/** Entités décodées APRÈS le strip des balises ; &amp; en DERNIER pour ne pas
 *  re-créer d'entités interprétables (&amp;lt; → texte littéral « &lt; »). */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

interface StyleState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

/** Trim des extrémités d'une ligne en préservant les espaces INTER-segments
 *  (« mot <i>x</i> » garde son espace) ; retire les segments devenus vides. */
function trimLine(line: SubtitleSegment[]): SubtitleSegment[] {
  while (line.length > 0) {
    line[0].text = line[0].text.replace(/^\s+/, "");
    if (line[0].text.length > 0) break;
    line.shift();
  }
  while (line.length > 0) {
    const last = line[line.length - 1];
    last.text = last.text.replace(/\s+$/, "");
    if (last.text.length > 0) break;
    line.pop();
  }
  return line;
}

/** Tokenise le texte brut d'une cue en lignes de segments stylés + ancrage. */
export function tokenizeCueText(raw: string): TokenizedCueText {
  const lines: SubtitleSegment[][] = [[]];
  const style: StyleState = { bold: false, italic: false, underline: false };
  let anchor: SubtitleAnchor | undefined;

  /** Ajoute du texte à la ligne courante, fusionné si le style n'a pas changé. */
  const pushText = (text: string) => {
    if (text.length === 0) return;
    const line = lines[lines.length - 1];
    const prev = line[line.length - 1];
    if (prev && !!prev.bold === style.bold && !!prev.italic === style.italic && !!prev.underline === style.underline) {
      prev.text += text;
      return;
    }
    const seg: SubtitleSegment = { text };
    if (style.bold) seg.bold = true;
    if (style.italic) seg.italic = true;
    if (style.underline) seg.underline = true;
    line.push(seg);
  };

  /** Run de texte entre deux balises : résidus ASS (\N, \n, \h) + entités. */
  const emitText = (run: string) => {
    if (run.length === 0) return;
    const cleaned = decodeEntities(run.replace(/\\[Nn]/g, "\n").replace(/\\h/g, " "));
    cleaned.split("\n").forEach((part, i) => {
      if (i > 0) lines.push([]);
      pushText(part);
    });
  };

  /** Un tag override ASS (sans son backslash), ex. "an8", "i1", "pos(960,80)". */
  const applyAssTag = (tag: string) => {
    let m: RegExpMatchArray | null;
    if ((m = tag.match(/^an([1-9])$/))) {
      // \an : pavé numérique (7-9 haut, 4-6 milieu, 1-3 bas). Un seul \an par
      // event en ASS : le PREMIER rencontré gagne (sémantique libass).
      const v = Number(m[1]);
      if (anchor === undefined) anchor = v >= 7 ? "top" : v >= 4 ? "middle" : "bottom";
    } else if ((m = tag.match(/^a(\d{1,2})$/))) {
      // \a legacy SSA : 1-3 bas, 5-7 haut, 9-11 milieu.
      const v = Number(m[1]);
      if (anchor === undefined) anchor = v >= 9 ? "middle" : v >= 5 ? "top" : "bottom";
    } else if ((m = tag.match(/^b(\d+)$/))) {
      // \b1 = gras ; \b700+ = graisse explicite « bold » ; \b0/\b400 = normal.
      const v = Number(m[1]);
      style.bold = v === 1 || v >= 700;
    } else if ((m = tag.match(/^i([01])$/))) {
      style.italic = m[1] === "1";
    } else if ((m = tag.match(/^u([01])$/))) {
      style.underline = m[1] === "1";
    } else if (tag.startsWith("r")) {
      // \r / \rStyle : retour au style de base (l'ancrage, lui, est conservé).
      style.bold = false;
      style.italic = false;
      style.underline = false;
    }
    // Tout le reste (\pos, \move, \c&H…&, \fad, \fs, \fn, \k…, \bord, \blur…) : strippé.
  };

  /** Bloc {…} : les tags suivent chacun un backslash ; {commentaire} = strip. */
  const applyAssBlock = (inner: string) => {
    const parts = inner.split("\\");
    for (let i = 1; i < parts.length; i++) applyAssTag(parts[i].trim());
  };

  /** Balise <…> : b/i/u interprétées, <br> = saut de ligne, le reste strippé
   *  (<c.classe>, <v Nom>, <font>, <ruby>, timestamps karaoké <00:00:00.000>…). */
  const applyHtmlTag = (tok: string) => {
    let m: RegExpMatchArray | null;
    if ((m = tok.match(/^<\/(b|i|u)>$/i))) {
      const key = m[1].toLowerCase() as "b" | "i" | "u";
      if (key === "b") style.bold = false;
      else if (key === "i") style.italic = false;
      else style.underline = false;
    } else if (/^<br\s*\/?>$/i.test(tok)) {
      lines.push([]);
    } else if ((m = tok.match(/^<(b|i|u)(?=[>\s.])/i))) {
      const key = m[1].toLowerCase() as "b" | "i" | "u";
      if (key === "b") style.bold = true;
      else if (key === "i") style.italic = true;
      else style.underline = true;
    }
  };

  const tokenRe = /\{[^}]*\}|<[^>]*>/g;
  let lastIndex = 0;
  for (let m = tokenRe.exec(raw); m !== null; m = tokenRe.exec(raw)) {
    emitText(raw.slice(lastIndex, m.index));
    const tok = m[0];
    if (tok.startsWith("{")) applyAssBlock(tok.slice(1, -1));
    else applyHtmlTag(tok);
    lastIndex = m.index + tok.length;
  }
  emitText(raw.slice(lastIndex));

  const finalLines = lines.map(trimLine).filter((line) => line.length > 0);
  return { lines: finalLines, anchor };
}
