import { describe, expect, it } from "vitest";
import postcss from "postcss";
import { passeVerre } from "./passeVerre";
import { creerContexte } from "./contexte";

const passer = (css: string) => {
  const racine = postcss.parse(css);
  passeVerre(racine, creerContexte());
  return racine.toString();
};

describe("passeVerre", () => {
  it("retire un flou d'arrière-plan, préfixé ou non", () => {
    expect(passer(".a{-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:red}"))
      .toBe(".a{color:red}");
  });

  it("ÉPARGNE `none` — c'est l'absence de flou, pas un flou", () => {
    // La règle universelle de `tv.css` est la seule chose qui atteigne les
    // `backdropFilter` posés en style en ligne dans `apps/web`. La passe l'avait
    // mangée, ce qui la rendait inopérante sans que rien ne le signale.
    const css = "*{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}";
    expect(passer(css)).toBe(css);
  });

  it("ne touche à rien d'autre", () => {
    expect(passer(".a{filter:blur(4px)}")).toBe(".a{filter:blur(4px)}");
  });
});

describe("gardeCompat et la neutralisation", () => {
  it("laisse passer une primitive mise à `none`", async () => {
    const { gardeCompat } = await import("./gardeCompat");
    const inerte = postcss.parse("*{backdrop-filter:none!important}");
    expect(gardeCompat(inerte)).toEqual([]);
  });

  it("refuse toujours la même primitive avec une vraie valeur", async () => {
    const { gardeCompat } = await import("./gardeCompat");
    const actif = postcss.parse(".a{backdrop-filter:blur(8px)}");
    expect(gardeCompat(actif)).toHaveLength(1);
  });
});
