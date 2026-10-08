/**
 * L'état affiché en tête de carte. L'interrupteur dit ce que VEUT l'admin ;
 * la pastille dit ce qui TOURNE : une extension activée que ce serveur refuse
 * (base SQLite non déclarée) ne tourne pas — « À mettre à jour », jamais
 * « Actif ».
 */
export function statePill(enabled: boolean, refused: boolean): { tone: "success" | "warning" | "neutral"; label: string } {
  if (!enabled) return { tone: "neutral", label: "stateDisabled" };
  return refused ? { tone: "warning", label: "stateNeedsUpdate" } : { tone: "success", label: "stateEnabled" };
}
