import type { WtChatMessageDto } from "@tentacle-tv/shared";

/**
 * Watch Together — le FIL du chat, en règles pures (sans React ni DOM) : comment les messages
 * se rangent en suites, lesquels sont des emojis seuls, où tombe la marque des non-lus. Rien ici ne touche au protocole (`wt:*`) ni aux règles partagées
 * (`packages/shared/src/watchTogether/`) : c'est de la présentation.
 */

/** Au-delà de deux minutes de silence, un même auteur rouvre une suite (son nom, l'heure). */
export const THREAD_RUN_GAP_MS = 120_000;

export interface ThreadRow {
  message: WtChatMessageDto;
  isSelf: boolean;
  /** Premier message d'une suite : il porte l'avatar, le nom et l'heure. */
  first: boolean;
  /** Dernier message d'une suite : ses coins se referment. */
  last: boolean;
  /** Un à trois emojis, rien d'autre : rendu en grand, sans bulle. */
  emojiOnly: boolean;
}

/** Deux messages se suivent-ils dans la même suite ? Même auteur, moins de deux minutes d'écart. */
function sameRun(a: WtChatMessageDto | undefined, b: WtChatMessageDto | undefined): boolean {
  return a !== undefined && b !== undefined && a.userId === b.userId && Math.abs(b.at - a.at) <= THREAD_RUN_GAP_MS;
}

/**
 * Les lignes du fil. `breakBefore` : l'identifiant d'un message qui ouvre TOUJOURS une suite
 * (la marque des non-lus passe au-dessus de lui — elle ne coupe pas une suite en deux).
 */
export function buildThread(messages: readonly WtChatMessageDto[], selfId: string | null, breakBefore: string | null = null): ThreadRow[] {
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    return {
      message,
      isSelf: selfId !== null && message.userId === selfId,
      first: message.id === breakBefore || !sameRun(previous, message),
      last: next?.id === breakBefore || !sameRun(message, next),
      emojiOnly: isEmojiOnly(message.text),
    };
  });
}

/**
 * Les classes Unicode des emojis, bâties à l'EXÉCUTION : un littéral `/\p{…}/u` est une erreur
 * de syntaxe pour tout le module sur un vieux moteur (le client LG compile ce dossier, Chrome
 * 53). Sans elles, aucun message n'est « emojis seuls » : il garde sa bulle.
 */
interface EmojiRules {
  /** Un caractère d'emoji. */
  one: RegExp;
  all: RegExp;
  /** Ce qui compose un emoji sans en être un : liant, variante, teinte de peau, touche. */
  glue: RegExp;
}

let rules: EmojiRules | null | undefined;

function emojiRules(): EmojiRules | null {
  if (rules !== undefined) return rules;
  try {
    const source = "\\p{Extended_Pictographic}|\\p{Regional_Indicator}";
    rules = { one: new RegExp(source, "u"), all: new RegExp(source, "gu"), glue: new RegExp("\\u200d|\\ufe0f|\\u20e3|\\p{Emoji_Modifier}", "gu") };
  } catch {
    rules = null;
  }
  return rules;
}

function graphemes(text: string, glue: RegExp): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((s) => s.segment);
  }
  // Sans `Intl.Segmenter` : les points de code — une famille ou un drapeau comptent alors pour
  // plusieurs, et le message garde simplement sa bulle.
  return [...text.replace(glue, "")];
}

/** Un à trois emojis, sans autre caractère que des espaces. */
export function isEmojiOnly(text: string): boolean {
  const emoji = emojiRules();
  if (emoji === null) return false;
  const compact = text.replace(/\s+/g, "");
  if (compact.length === 0 || compact.length > 40) return false;
  const parts = graphemes(compact, emoji.glue);
  if (parts.length === 0 || parts.length > 3) return false;
  return parts.every((part) => emoji.one.test(part) && part.replace(emoji.glue, "").replace(emoji.all, "") === "");
}

/**
 * Le premier message NON LU à l'ouverture du panneau : les `unread` derniers messages des
 * autres (le compteur ne compte qu'eux, et l'on n'écrit pas panneau fermé). `null` : rien à
 * marquer.
 */
export function firstUnreadId(messages: readonly WtChatMessageDto[], unread: number, selfId: string | null): string | null {
  if (unread <= 0) return null;
  let remaining = unread;
  let found: string | null = null;
  for (let i = messages.length - 1; i >= 0 && remaining > 0; i--) {
    const message = messages[i]!;
    if (selfId !== null && message.userId === selfId) continue;
    found = message.id;
    remaining -= 1;
  }
  return found;
}
