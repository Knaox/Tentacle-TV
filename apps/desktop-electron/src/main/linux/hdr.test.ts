import { describe, expect, it } from "vitest";
import { describeReading, type Reading } from "./hdr";

const reading = (content: string | null, output: string): Reading =>
  ({ content, output, primaries: "bt.2020", peak: 3.813229 });

describe("decrire", () => {
  it("dit le couple, jamais un côté seul", () => {
    // `video-target-params` décrit la SURFACE : sur un écran laissé en HDR il
    // vaut `pq` même pour du bt.709. Seul le couple distingue les cas.
    expect(describeReading(reading("pq", "pq"))).toBe("contenu pq → sortie pq/bt.2020 · pic 3.81×");
  });

  it("alerte quand un film HDR sort en SDR — c'est le seul cas qui compte", () => {
    expect(describeReading(reading("pq", "bt.1886"))).toContain("TONE-MAPPÉ");
    expect(describeReading(reading("hlg", "gamma2.2"))).toContain("TONE-MAPPÉ");
  });

  it("n'alerte pas quand c'est du SDR converti : rien n'est perdu", () => {
    expect(describeReading(reading("bt.1886", "pq"))).toContain("SDR converti");
    expect(describeReading(reading("bt.1886", "pq"))).not.toContain("TONE-MAPPÉ");
  });

  it("ne dit rien de plus quand les deux côtés sont du SDR", () => {
    const line = describeReading(reading("bt.1886", "bt.1886"));
    expect(line).not.toContain("TONE-MAPPÉ");
    expect(line).not.toContain("converti");
  });

  it("supporte un contenu encore inconnu", () => {
    expect(describeReading(reading(null, "pq"))).toContain("contenu ?");
  });

  it("omet le pic quand mpv ne l'a pas donné", () => {
    expect(describeReading({ content: "pq", output: "pq", primaries: "bt.2020", peak: null }))
      .toBe("contenu pq → sortie pq/bt.2020");
  });
});
