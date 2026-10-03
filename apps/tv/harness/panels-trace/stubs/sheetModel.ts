import { api } from "./api-client";
import { hosts, note } from "./record";

/**
 * Le modèle du grand panneau (`useSheetModel`), posé par le scénario : la
 * note et les pictos que la carte aurait résolus, tels qu'au moment du rendu.
 */
export function useSheetModel(input: { mode: string; onClose: () => void }) {
  hosts.set("sheetModelInput", { mode: input.mode });
  const model = (api.sheetModel as Record<string, unknown>) ?? {};
  return {
    header: { title: "Titre", shape: "poster" },
    actions: [],
    rating: null,
    ...model,
    onAction: (kind: string) => note({ action: kind }),
    onRate: (score: number | null) => note({ rated: score }),
    onClose: input.onClose,
  };
}
