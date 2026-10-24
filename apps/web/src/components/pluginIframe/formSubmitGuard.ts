/**
 * L'iframe des extensions n'a pas `allow-forms` (`PLUGIN_IFRAME_SANDBOX`,
 * plugins-api) : Chromium y avale tout envoi de formulaire sans déclencher
 * `submit`, et la page ne dit rien. Ce script, posé par le pont, le dit au
 * DÉVELOPPEUR de l'extension : un avertissement dans la console, une fois par
 * page, quand un envoi natif est tenté — clic d'un bouton d'envoi d'un
 * `<form>`, ou Entrée dans un champ d'une ligne d'un `<form>`. Rien d'autre :
 * il n'envoie rien à la place de la page.
 */
export const FORM_SUBMIT_WARNING =
  "[Tentacle] Envoi de formulaire bloqué : l'iframe des extensions n'a pas allow-forms, submit ne part jamais. "
  + "Pas de <form> : envoyer au clic d'un bouton type=\"button\" et à Entrée par un keydown (voir PLUGIN_IFRAME_SANDBOX).";

/** Script (sans balises) du garde, inséré dans le pont de l'iframe. */
export function buildFormSubmitGuardScript(): string {
  return `
    // ── Formulaire natif : submit ne part jamais (sandbox sans allow-forms) ──
    (function() {
      if (typeof document === "undefined" || !document.addEventListener) return;
      var warned = false;
      var single = { "": 1, text: 1, url: 1, number: 1, password: 1, search: 1, email: 1, tel: 1 };
      function warn() {
        if (warned) return;
        warned = true;
        console.warn(${JSON.stringify(FORM_SUBMIT_WARNING)});
      }
      document.addEventListener("click", function(e) {
        var el = e.target && e.target.closest ? e.target.closest("button, input") : null;
        if (!el || !el.form) return;
        var type = (el.getAttribute("type") || (el.tagName === "BUTTON" ? "submit" : "")).toLowerCase();
        if (type === "submit" || type === "image") warn();
      }, true);
      document.addEventListener("keydown", function(e) {
        var t = e.target;
        if (e.key !== "Enter" || e.isComposing || !t || t.tagName !== "INPUT" || !t.form) return;
        if (single[(t.getAttribute("type") || "").toLowerCase()]) warn();
      }, true);
    })();
`;
}
