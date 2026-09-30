/**
 * Le libellé d'une piste en deux temps, pour se lire à trois mètres : ce qui
 * la NOMME (« ENG VO : DDP 5.1 », « Forcés »), puis ce qui la décrit
 * (« English · Dolby Digital+ · Par défaut »). Jellyfin compose `DisplayTitle`
 * en segments séparés par « - » ; on les répartit, sans rien réécrire.
 * Un libellé sans segment reste entier.
 */
export function splitTrackLabel(label: string): { label: string; detail?: string } {
  const parts = label.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return { label };
  return { label: parts[0], detail: parts.slice(1).join(" · ") };
}
