// Les retouches de CAPTURE seulement, posées sur toutes les pages de l'onglet.
// Elles ne changent rien de ce que l'app montre ; elles retirent ce qu'un
// écran figé ne doit pas porter :
//  - les barres de défilement (le bureau et le téléphone les cachent au repos) ;
//  - le curseur clignotant d'un champ de saisie ;
//  - le grain du héros (`.noise-texture`, opacité 0,06). Il figeait Chrome
//    sans tête à haute densité (mesuré le 2026-10-01) ; à 6 % il n'est pas
//    visible, et les compositions de la vitrine posent leur propre grain.
const CSS = [
  "html,body,*{scrollbar-width:none!important}",
  "::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}",
  "input,textarea{caret-color:transparent!important}",
  ".noise-texture{background-image:none!important}",
].join("");

/** Pose la feuille de capture sur chaque document HTML de l'onglet. */
export async function installCaptureCss(page) {
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const add = () => {
        if (!document.head) return;
        const s = document.createElement("style");
        s.setAttribute("data-vitrine", "capture");
        s.textContent = ${JSON.stringify(CSS)};
        document.head.append(s);
      };
      document.head ? add() : addEventListener("DOMContentLoaded", add);
    })();`,
  });
}
