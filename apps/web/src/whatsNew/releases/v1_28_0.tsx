import type { WhatsNewRelease } from "../types";

/**
 * 1.28.0 — numéro PROPOSÉ (chantier PiP du 09.10.2026), entrée VIDE : le
 * registre doit connaître la version desktop dès son bump (registry.test.ts).
 *
 * Le picture-in-picture n'existe que sous Linux avec KDE (la colle KWin) : une
 * scène le montrerait aussi aux utilisateurs de Windows et de macOS, qui n'ont
 * pas le bouton. À mettre en scène le jour où il gagne les autres systèmes.
 */
export const RELEASE_1_28_0: WhatsNewRelease = {
  version: "1.28.0",
  features: [],
};
