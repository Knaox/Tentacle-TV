import { describe, expect, it } from "vitest";
import { decrire, type Releve } from "./hdr";

const releve = (contenu: string | null, sortie: string): Releve =>
  ({ contenu, sortie, primaires: "bt.2020", pic: 3.813229 });

describe("decrire", () => {
  it("dit le couple, jamais un côté seul", () => {
    // `video-target-params` décrit la SURFACE : sur un écran laissé en HDR il
    // vaut `pq` même pour du bt.709. Seul le couple distingue les cas.
    expect(decrire(releve("pq", "pq"))).toBe("contenu pq → sortie pq/bt.2020 · pic 3.81×");
  });

  it("alerte quand un film HDR sort en SDR — c'est le seul cas qui compte", () => {
    expect(decrire(releve("pq", "bt.1886"))).toContain("TONE-MAPPÉ");
    expect(decrire(releve("hlg", "gamma2.2"))).toContain("TONE-MAPPÉ");
  });

  it("n'alerte pas quand c'est du SDR converti : rien n'est perdu", () => {
    expect(decrire(releve("bt.1886", "pq"))).toContain("SDR converti");
    expect(decrire(releve("bt.1886", "pq"))).not.toContain("TONE-MAPPÉ");
  });

  it("ne dit rien de plus quand les deux côtés sont du SDR", () => {
    const ligne = decrire(releve("bt.1886", "bt.1886"));
    expect(ligne).not.toContain("TONE-MAPPÉ");
    expect(ligne).not.toContain("converti");
  });

  it("supporte un contenu encore inconnu", () => {
    expect(decrire(releve(null, "pq"))).toContain("contenu ?");
  });

  it("omet le pic quand mpv ne l'a pas donné", () => {
    expect(decrire({ contenu: "pq", sortie: "pq", primaires: "bt.2020", pic: null }))
      .toBe("contenu pq → sortie pq/bt.2020");
  });
});
