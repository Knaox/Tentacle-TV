// Parcours dans la page (par CDP) : premier écran, connexion. Repris du banc liquid-glass de
// l'ancien bureau Electron (retiré, 1.50.0) — la seule partie dont ce banc a besoin.

/** Tape dans le champ `selector` (focus + insertText : React voit un vrai `input`). */
export async function typeInto(page, selector, text) {
  await page.waitFor(`document.querySelector(${JSON.stringify(selector)})`, 20_000, selector);
  await page.evaluate(`const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select?.(); return true;`);
  await page.send("Input.insertText", { text });
}

export async function submitForm(page, selector) {
  await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).closest("form").requestSubmit(); return true;`);
}

/** Écran « adresse du serveur » puis connexion. Idempotent : saute ce qui est fait. */
export async function connectAndLogin(page, { server, username, password }) {
  await page.waitFor(
    `document.querySelector('input[inputmode="url"], input[autocomplete="username"]') || localStorage.getItem("tentacle_user")`,
    30_000,
    "premier écran",
  );
  const state = await page.evaluate(`return {
    connect: !!document.querySelector('input[inputmode="url"]'),
    authed: !!localStorage.getItem("tentacle_user"),
  };`);
  if (state.authed) return;
  if (state.connect) {
    await typeInto(page, 'input[inputmode="url"]', server);
    await submitForm(page, 'input[inputmode="url"]');
  }
  await page.waitFor(`document.querySelector('input[autocomplete="username"]')`, 30_000, "écran de connexion");
  await typeInto(page, 'input[autocomplete="username"]', username);
  await typeInto(page, 'input[autocomplete="current-password"]', password);
  await submitForm(page, 'input[autocomplete="current-password"]');
  await page.waitFor(`localStorage.getItem("tentacle_user")`, 30_000, "session ouverte");
}
