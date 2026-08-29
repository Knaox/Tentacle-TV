import { checkScreen, focusableRects, describeIt, type Violation } from "./focusRules";

/**
 * La surcouche de débogage du focus.
 *
 * Elle montre trois choses qu'on ne peut pas deviner en regardant l'écran :
 * l'élément qui porte réellement le focus, la limite des 5 % que la dalle
 * rogne, et le rectangle de chaque cible atteignable. Puis elle liste ce que
 * `focusRules` a trouvé.
 *
 * **Jamais en production.** `__TV_DEBUG__` est figé à faux par la configuration
 * de build : l'appel d'installation disparaît, ce module avec lui, et
 * `focusRules` avec lui. Rien de tout cela ne pèse dans le fragment servi à un
 * téléviseur.
 *
 * Écrite sans React, et volontairement : elle doit pouvoir s'afficher quand
 * l'arbre React est cassé, ce qui est précisément le moment où l'on en a besoin.
 * Elle ne pose aucun élément focusable — ce serait fausser sa propre mesure.
 */

const SHORTCUT = "d";
const ID = "tv-debug";

let visible = false;

export function installDebugOverlay(): () => void {
  const surTouche = (event: KeyboardEvent) => {
    // Un raccourci à deux doigts : la télécommande n'a pas de modificateur, donc
    // aucun risque de l'activer par mégarde depuis un canapé.
    if (!event.ctrlKey || !event.shiftKey) return;
    if (event.key.toLowerCase() !== SHORTCUT) return;
    event.preventDefault();
    toggle();
  };

  document.addEventListener("keydown", surTouche, true);
  return () => {
    document.removeEventListener("keydown", surTouche, true);
    remove3();
  };
}

function toggle(): void {
  visible = !visible;
  if (visible) draw();
  else remove3();
}

function remove3(): void {
  document.getElementById(ID)?.remove();
}

function draw(): void {
  remove3();

  const racine = document.createElement("div");
  racine.id = ID;
  racine.setAttribute("aria-hidden", "true");
  racine.style.cssText = [
    "position:fixed",
    "left:0;top:0;right:0;bottom:0",
    "z-index:2147483647",
    "pointer-events:none",
    "font-family:monospace",
    "font-size:13px",
  ].join(";");

  racine.appendChild(cadreZoneSure());
  for (const { element, rect } of focusableRects()) {
    racine.appendChild(targetFrame(rect, element === document.activeElement));
  }
  racine.appendChild(panel(checkScreen()));

  document.body.appendChild(racine);
}

function cadreZoneSure(): HTMLElement {
  const cadre = document.createElement("div");
  const x = window.innerWidth * 0.05;
  const y = window.innerHeight * 0.05;
  cadre.style.cssText = [
    "position:absolute",
    `left:${x}px;top:${y}px`,
    `width:${window.innerWidth - 2 * x}px`,
    `height:${window.innerHeight - 2 * y}px`,
    "border:1px dashed rgba(255,180,0,0.9)",
  ].join(";");
  return cadre;
}

function targetFrame(rect: DOMRect, active: boolean): HTMLElement {
  const cadre = document.createElement("div");
  cadre.style.cssText = [
    "position:absolute",
    `left:${rect.left}px;top:${rect.top}px`,
    `width:${rect.width}px;height:${rect.height}px`,
    `border:1px solid ${active ? "rgba(0,255,120,0.95)" : "rgba(0,160,255,0.55)"}`,
  ].join(";");
  return cadre;
}

function panel(violations: Violation[]): HTMLElement {
  const box = document.createElement("div");
  box.style.cssText = [
    "position:absolute",
    "right:12px;top:12px",
    "max-width:520px;max-height:70vh;overflow:hidden",
    "padding:12px 14px",
    "background:rgba(0,0,0,0.88)",
    "color:#fff",
    "border:1px solid rgba(255,255,255,0.25)",
    "line-height:1.5",
    "white-space:pre-wrap",
  ].join(";");

  const active = document.activeElement;
  const activeName =
    active instanceof HTMLElement && active !== document.body ? describeIt(active) : "AUCUN — règle n°1 violée";

  const errors = violations.filter((violation) => violation.severity === "erreur");
  const warnings = violations.filter((violation) => violation.severity !== "erreur");

  const lines = [
    `focus : ${activeName}`,
    `cibles : ${focusableRects().length}`,
    `erreurs : ${errors.length}   avertissements : ${warnings.length}`,
    "",
    ...violations
      .slice(0, 14)
      .map((violation) => `[${violation.rule}] ${violation.element}\n   ${violation.detail}`),
  ];
  if (violations.length > 14) lines.push(`… et ${violations.length - 14} de plus`);

  box.textContent = lines.join("\n");
  return box;
}
