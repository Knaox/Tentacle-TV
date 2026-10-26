// Ouvre le menu du compte (barre du haut) avant la mesure.
const b = document.querySelector(".lgc-avatar")?.closest("button");
b?.click();
await new Promise((r) => setTimeout(r, 900));
return !!b;
