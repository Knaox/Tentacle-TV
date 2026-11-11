import { supportsAppUpdates } from "../../desktop/capabilities";
import { clearNetworkProbe, outgoingRequests } from "../networkProbe";
import type { DebugAction } from "./debugActionTypes";
import { debugShell } from "./debugShell";
import { runUpdateDemo, updateDemoChoices, updateDemoUnavailable } from "./debugUpdateDemo";

/** Les groupes « Application » et « Réseau » : les surcouches qu'on ne voit jamais au bon moment. */
export const APP_ACTIONS: readonly DebugAction[] = [
  {
    id: "update",
    key: "u",
    group: "app",
    kind: "button",
    label: "Pop-up de mise à jour",
    /**
     * Elle ne s'affiche autrement que lorsqu'une mise à jour existe réellement — autant dire
     * jamais au moment où l'on travaille dessus, et jamais hors d'un paquet installé. Chaque
     * coquille montre LA SIENNE (`debugUpdateDemo.ts`).
     */
    hint: "Montre la vraie pop-up de cette coquille, dans l'état choisi. Rien n'est téléchargé ni installé.",
    choices: updateDemoChoices(debugShell().kind, supportsAppUpdates()),
    status: () => {
      const unavailable = updateDemoUnavailable(debugShell().kind);
      return unavailable === undefined ? {} : { unavailable };
    },
    run: async (choice) => runUpdateDemo(debugShell().kind, choice),
  },
  {
    id: "whats-new",
    key: "n",
    group: "app",
    kind: "button",
    label: "Écran des nouveautés",
    hint: "Tout le registre des nouveautés, sans écrire le drapeau « déjà vu ».",
    status: () => (typeof (window as unknown as { __tentacleShowWhatsNew?: unknown }).__tentacleShowWhatsNew === "function"
      ? {}
      : { unavailable: "écran des nouveautés non monté sur cette page" }),
    run: async () => {
      const w = window as unknown as { __tentacleShowWhatsNew?: (version?: string) => void };
      if (!w.__tentacleShowWhatsNew) return "écran des nouveautés indisponible";
      w.__tentacleShowWhatsNew();
      return "écran des nouveautés affiché — tout le registre, sans écrire le drapeau";
    },
  },
  {
    id: "network-clear",
    key: "r",
    group: "network",
    kind: "button",
    label: "Vider le journal réseau",
    // Le geste qui rend la section « Réseau » utile : on vide, on lance la lecture, et ce qui
    // apparaît est EXACTEMENT ce que cette lecture a provoqué.
    hint: "Remet à zéro la section « Réseau sortant » du diagnostic.",
    status: () => ({ value: `${outgoingRequests().length}` }),
    run: async () => {
      const before = outgoingRequests().length;
      clearNetworkProbe();
      return `journal vidé — ${before} requête${before > 1 ? "s" : ""} effacée${before > 1 ? "s" : ""}`;
    },
  },
];
