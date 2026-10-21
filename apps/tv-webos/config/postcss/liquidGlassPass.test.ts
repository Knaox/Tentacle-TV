import { describe, expect, it } from "vitest";
import postcss from "postcss";
import { liquidGlassPass } from "./liquidGlassPass";
import { compatGuard } from "./compatGuard";
import { createContext } from "./context";

const run = (css: string) => {
  const root = postcss.parse(css);
  liquidGlassPass(root, createContext());
  return root;
};

describe("liquidGlassPass", () => {
  it("retire une règle scopée au drapeau du verre du bureau", () => {
    const css = ':root[data-lg="on"] :is(.a,.b){background:color-mix(in srgb,red 50%,transparent);inset:0}.c{color:red}';
    expect(run(css).toString()).toBe(".c{color:red}");
  });

  it("ne garde, dans une liste, que les sélecteurs sans drapeau", () => {
    expect(run('.a,:root[data-liquid-glass="native"] .b{color:red}').toString()).toBe(".a{color:red}");
  });

  it("retire le bloc @media qu'elle a vidé", () => {
    const css = '@media (hover:hover){:root[data-lg="on"] .a:hover::after{opacity:1}}.b{color:red}';
    expect(run(css).toString()).toBe(".b{color:red}");
  });

  it("rend la feuille acceptable par la garde du téléviseur", () => {
    const root = run(':root[data-lg="on"]{--x:color-mix(in srgb,red 50%,blue)}:root[data-lg="on"] .a{inset:0;backdrop-filter:blur(8px)}');
    expect(compatGuard(root)).toEqual([]);
  });

  it("ne touche à rien d'autre", () => {
    const css = ".lg-btn{color:red}[data-theme=light] .a{color:blue}";
    expect(run(css).toString()).toBe(css);
  });
});
