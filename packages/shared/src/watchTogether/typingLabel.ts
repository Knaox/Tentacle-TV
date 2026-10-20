/**
 * Watch Together — ce que dit « est en train d'écrire », partout pareil :
 * un nom, deux noms, ou un nom et le nombre des autres. Clés de l'espace i18n
 * `watchTogether` (`typingOne`, `typingTwo`, `typingMany`).
 */

export type WtTypingLabel =
  | { key: "typingOne"; params: { name: string } }
  | { key: "typingTwo"; params: { a: string; b: string } }
  | { key: "typingMany"; params: { name: string; count: number } };

/** null : personne n'écrit. L'ordre est celui d'arrivée (le premier nommé). */
export function typingLabelKey(typing: readonly { username: string }[]): WtTypingLabel | null {
  if (typing.length === 0) return null;
  if (typing.length === 1) return { key: "typingOne", params: { name: typing[0].username } };
  if (typing.length === 2) return { key: "typingTwo", params: { a: typing[0].username, b: typing[1].username } };
  return { key: "typingMany", params: { name: typing[0].username, count: typing.length - 1 } };
}
