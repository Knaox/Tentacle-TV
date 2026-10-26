/**
 * L'état affiché en tête de carte. L'interrupteur dit ce que VEUT l'admin ;
 * la pastille dit ce qui TOURNE : une extension activée que ce serveur refuse
 * (base SQLite non déclarée) ne tourne pas — « À mettre à jour », jamais
 * « Actif ».
 */
export function statePill(
  enabled: boolean,
  refused: boolean,
  /** L'extension exige ce Tentacle, que ce serveur n'atteint pas : la pastille le dit. */
  requires: string | null = null,
): { tone: "success" | "warning" | "neutral"; label: string; values?: { version: string } } {
  if (!enabled) return { tone: "neutral", label: "stateDisabled" };
  if (requires) return { tone: "warning", label: "requiresServer", values: { version: requires } };
  return refused ? { tone: "warning", label: "stateNeedsUpdate" } : { tone: "success", label: "stateEnabled" };
}
