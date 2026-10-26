// Ouvre le menu « Plus » (barre du haut) avant la mesure.
const b = [...document.querySelectorAll("header button")].find((x) => /Plus|More/.test(x.textContent));
b?.click();
await new Promise((r) => setTimeout(r, 900));
return !!b;
