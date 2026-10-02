import { describe, expect, it } from "vitest";

import { detailMove, type DetailPage, type DetailTarget } from "./detailChain";

const title = (id: string): DetailPage => ({ kind: "title", id });
const person = (id: string): DetailPage => ({ kind: "person", id });

/** Une pile de pages, et ce qu'y fait l'ouverture d'une fiche — comme la navigation. */
function open(stack: DetailPage[], target: DetailTarget): DetailPage[] {
  const from = stack[stack.length - 1] ?? null;
  const below = stack[stack.length - 2] ?? null;
  const page: DetailPage = { kind: target.kind, id: target.id };
  switch (detailMove(from, target, below)) {
    case "push":
      return [...stack, page];
    case "replace":
      return [...stack.slice(0, -1), page];
    case "back":
      return stack.slice(0, -1);
    case "stay":
      return stack;
  }
}

describe("detailMove — la suite de fiches", () => {
  it("depuis une page qui n'est pas une fiche, la première fiche s'empile", () => {
    expect(detailMove(null, { kind: "title", id: "a" }, null)).toBe("push");
  });

  it("une fiche ouverte depuis une autre fiche la remplace", () => {
    expect(detailMove(title("a"), { kind: "title", id: "b" }, null)).toBe("replace");
    expect(detailMove(title("a"), { kind: "person", id: "p" }, null)).toBe("replace");
    expect(detailMove(person("p"), { kind: "title", id: "b" }, null)).toBe("replace");
  });

  it("des similaires en série : un seul Retour ramène à l'accueil", () => {
    // `null` : l'accueil, qui n'est pas une fiche.
    let stack: DetailPage[] = [null];
    for (const id of ["a", "b", "c", "d"]) stack = open(stack, { kind: "title", id });
    expect(stack).toEqual([null, title("d")]);
  });

  it("une personne, puis un de ses films, puis une autre personne : toujours une seule fiche", () => {
    let stack: DetailPage[] = [null];
    stack = open(stack, { kind: "title", id: "film" });
    stack = open(stack, { kind: "person", id: "actrice" });
    stack = open(stack, { kind: "title", id: "autre-film" });
    stack = open(stack, { kind: "person", id: "realisateur" });
    expect(stack).toEqual([null, person("realisateur")]);
  });

  it("descendre d'une série vers ses saisons et ses épisodes empile, comme avant", () => {
    expect(detailMove(title("serie"), { kind: "title", id: "ep", seriesId: "serie", seasonId: "s1" }, null)).toBe("push");
    expect(detailMove(title("s1"), { kind: "title", id: "ep", seriesId: "serie", seasonId: "s1" }, title("serie"))).toBe("push");
  });

  it("remonter d'un épisode à sa série juste dessous recule, sans seconde fiche de la série", () => {
    let stack: DetailPage[] = [null];
    stack = open(stack, { kind: "title", id: "serie" });
    stack = open(stack, { kind: "title", id: "ep", seriesId: "serie" });
    expect(stack).toEqual([null, title("serie"), title("ep")]);
    stack = open(stack, { kind: "title", id: "serie" });
    expect(stack).toEqual([null, title("serie")]);
  });

  it("remonter d'un épisode ouvert d'ailleurs à sa série la remplace", () => {
    // L'épisode vient de « Reprendre » sur l'accueil : sa série n'est pas dessous.
    expect(detailMove(title("ep"), { kind: "title", id: "serie" }, null)).toBe("replace");
  });

  it("un titre ouvert depuis un épisode remplace l'épisode, la série reste dessous", () => {
    let stack: DetailPage[] = [null, title("serie"), title("ep")];
    stack = open(stack, { kind: "title", id: "similaire" });
    expect(stack).toEqual([null, title("serie"), title("similaire")]);
  });

  it("rouvrir la fiche où l'on est ne fait rien", () => {
    expect(detailMove(title("a"), { kind: "title", id: "a" }, null)).toBe("stay");
  });
});
