/** Accès React à la préférence « sauter l'intro toute seule ». */

import { useSyncExternalStore } from "react";

import {
  getAutoSkipIntro,
  subscribeAutoSkipIntro,
} from "../lib/autoSkipIntro";

export function useAutoSkipIntro(): boolean {
  return useSyncExternalStore(
    subscribeAutoSkipIntro,
    getAutoSkipIntro,
    getAutoSkipIntro,
  );
}
