/**
 * Les touches de la rangée des profils (tabulation itinérante) : l'index de la
 * tuile qui prend le focus, ou null si la touche ne concerne pas la rangée.
 * Les flèches bouclent (six profils au plus : on n'y perd jamais le fil).
 * Module pur.
 */
export function nextTileIndex(key: string, index: number, count: number): number | null {
  if (count <= 0 || index < 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
