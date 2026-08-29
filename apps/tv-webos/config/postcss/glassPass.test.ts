import { describe, expect, it } from "vitest";
import postcss from "postcss";
import { glassPass } from "./glassPass";
import { createContext } from "./context";

const skip = (css: string) => {
  const root = postcss.parse(css);
  glassPass(root, createContext());
  return root.toString();
};

describe("glassPass", () => {
  it("retire un flou d'arrière-plan, préfixé ou non", () => {
    expect(skip(".a{-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:red}"))
      .toBe(".a{color:red}");
  });

  it("ÉPARGNE `none` — c'est l'absence de flou, pas un flou", () => {
    // La règle universelle de `tv.css` est la seule chose qui atteigne les
    // `backdropFilter` posés en style en ligne dans `apps/web`. La passe l'avait
    // mangée, ce qui la rendait inopérante sans que rien ne le signale.
    const css = "*{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}";
    expect(skip(css)).toBe(css);
  });

  it("ne touche à rien d'autre", () => {
    expect(skip(".a{filter:blur(4px)}")).toBe(".a{filter:blur(4px)}");
  });
});

describe("compatGuard et la neutralisation", () => {
  it("laisse passer une primitive mise à `none`", async () => {
    const { compatGuard } = await import("./compatGuard");
    const inert = postcss.parse("*{backdrop-filter:none!important}");
    expect(compatGuard(inert)).toEqual([]);
  });

  it("refuse toujours la même primitive avec une vraie valeur", async () => {
    const { compatGuard } = await import("./compatGuard");
    const active = postcss.parse(".a{backdrop-filter:blur(8px)}");
    expect(compatGuard(active)).toHaveLength(1);
  });
});
