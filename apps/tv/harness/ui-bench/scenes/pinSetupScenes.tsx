import { PIN_SETUP_CREATE_KEY, PIN_SETUP_LATER_KEY } from "@tentacle-tv/tv-core";
import { PinSetupView, type PinSetupModel } from "../../../src/redesign/screens/pinSetup/PinSetupView";
import type { BenchScene } from "./types";

/**
 * Le code PIN conseillé du premier passage dans un profil : le propriétaire
 * d'une famille (qui gérerait la famille avec un code — le texte le dit), un
 * membre qui ne gère rien de plus, un nom long, et l'attente (rien à lire).
 * Le pavé qui suit « Créer un code PIN » est celui de Réglages › Compte.
 */

const offer = (name: string, color: "violet" | "teal" | "amber", reason: "protect" | "protectAndManage"): PinSetupModel => ({
  kind: "offer",
  profile: { name, color },
  reason,
});

const KEYS = [PIN_SETUP_CREATE_KEY, PIN_SETUP_LATER_KEY];

export const PIN_SETUP_SCENES: BenchScene[] = [
  {
    id: "code-pin/proprietaire",
    group: "Code PIN conseillé",
    label: "Le propriétaire, sans code (il gérera la famille avec)",
    focusKeys: KEYS,
    render: () => <PinSetupView model={offer("Knaoxtest", "violet", "protectAndManage")} />,
  },
  {
    id: "code-pin/membre",
    group: "Code PIN conseillé",
    label: "Un membre, sans code (protéger seulement)",
    focusKeys: KEYS,
    render: () => <PinSetupView model={offer("Léa", "teal", "protect")} />,
  },
  {
    id: "code-pin/nom-long",
    group: "Code PIN conseillé",
    label: "Un nom long",
    focusKeys: [PIN_SETUP_CREATE_KEY],
    render: () => <PinSetupView model={offer("Marie-Antoinette de Saint-Exupéry", "amber", "protectAndManage")} />,
  },
  {
    id: "code-pin/attente",
    group: "Code PIN conseillé",
    label: "L'étape cède la place (rien à lire)",
    render: () => <PinSetupView model={{ kind: "waiting" }} />,
  },
];
