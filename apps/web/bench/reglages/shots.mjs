/**
 * Les PLANS du banc : un écran du labo (`vue`, cf. `src/dev/reglagesLab/labViews.ts`), ses
 * paramètres, et le geste à faire avant la photo. Le nom du plan nomme le fichier.
 */

/** Tape dans la recherche des réglages : les résultats remplacent la rubrique. */
async function searchSettings(page, query) {
  await page.getByRole("searchbox").fill(query);
  await page.waitForTimeout(300);
}

/** Ouvre tous les replis encore fermés (« Avancé », explications), du haut vers le bas. */
async function openEveryFold(page) {
  for (let pass = 0; pass < 6; pass += 1) {
    const closed = page.locator('main button[aria-expanded="false"], [data-lab-world] button[aria-expanded="false"]');
    if ((await closed.count()) === 0) break;
    await closed.first().click();
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(400);
}

/** Réglages › Téléchargements par son entrée du rail, une fois les droits du hors ligne lus. */
async function openDownloadsFromRail(page) {
  await page.getByText("Téléchargements", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(900);
}

export const SHOTS = [
  { name: "reglages-lecture", vue: "lecture" },
  // Un compte qui a déjà réglé finement : la tuile « Personnalisé », et ses « Avancé » ouverts d'office.
  { name: "reglages-lecture-personnalisee", vue: "lecture-personnalisee", settle: 1200 },
  // « Avancé » déplié : une adresse qui vise un réglage rare ouvre son repli (comme la recherche).
  { name: "reglages-lecture-avance", vue: "lecture", params: { ancre: "skipPassages" }, settle: 1200, act: openEveryFold },
  { name: "reglages-recherche", vue: "lecture", act: (page) => searchSettings(page, "sous-titres") },
  { name: "reglages-recherche-avance", vue: "lecture", act: (page) => searchSettings(page, "intro") },
  { name: "reglages-recherche-vide", vue: "lecture", act: (page) => searchSettings(page, "xyzzy") },
  // Trois prévisualisations, cadrées : le vrai bouton du lecteur, la fiche « à suivre », l'affiche de fin.
  { name: "apercu-passage", vue: "lecture", params: { ancre: "skipPassages" }, settle: 1500, clip: '[data-setting="skipPassages"]' },
  { name: "apercu-episode-suivant", vue: "lecture", params: { ancre: "upNext" }, settle: 1500, act: openEveryFold, clip: '[data-setting="upNext"]' },
  { name: "apercu-theme", vue: "apparence", clip: '[data-setting="theme"]' },
  { name: "reglages-langues", vue: "langues" },
  { name: "reglages-apparence", vue: "apparence" },
  { name: "reglages-accueil", vue: "accueil" },
  { name: "reglages-famille", vue: "famille" },
  { name: "reglages-compte", vue: "compte" },
  // La coquille de bureau simulée (`index.html`, `?bureau=`) : décodage, session graphique, emplacement et espace.
  { name: "reglages-lecture-bureau", vue: "lecture-bureau", params: { bureau: "linux" } },
  // Ouverte à froid, la page se replie sur Lecture (ses droits ne sont pas encore lus) : on y va par le rail, comme un utilisateur.
  { name: "reglages-telechargements", vue: "telechargements", params: { bureau: "linux" }, act: openDownloadsFromRail },
  { name: "admin-vue-ensemble", vue: "admin" },
  { name: "admin-a-regler", vue: "admin-a-regler" },
  { name: "admin-recommandations", vue: "admin-recommandations" },
  { name: "admin-utilisateurs", vue: "admin-utilisateurs" },
  { name: "admin-invitations", vue: "admin-invitations" },
  { name: "admin-services", vue: "admin-services" },
  { name: "admin-metadonnees", vue: "admin-metadonnees" },
  { name: "admin-extensions", vue: "admin-extensions" },
  { name: "admin-acces-distant", vue: "admin-acces-distant" },
  { name: "admin-sessions", vue: "admin-sessions" },
  { name: "admin-tickets", vue: "admin-tickets" },
  { name: "admin-famille", vue: "admin-famille" },
  { name: "admin-telechargements", vue: "admin-telechargements" },
  { name: "admin-systeme", vue: "admin-systeme" },
  { name: "qui-regarde", vue: "qui-regarde", ready: "button", fullPage: false },
  { name: "qui-regarde-code", vue: "qui-regarde", params: { q: "pin=1" }, ready: "button", fullPage: false },
  { name: "connexion", vue: "connexion", params: { session: "none" }, ready: "form", fullPage: false },
  { name: "inscription", vue: "inscription", params: { session: "none" }, ready: "form", fullPage: false },
  { name: "jumelage", vue: "jumelage" },
  { name: "assistant", vue: "assistant", params: { session: "none" }, ready: "button", fullPage: false },
  { name: "aide", vue: "aide", ready: "h1, h2" },
  { name: "aide-bandes-annonces", vue: "aide-bandes-annonces" },
  { name: "a-propos", vue: "a-propos" },
  { name: "credits", vue: "credits" },
];
