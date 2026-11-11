/** Ce qu'on lit d'i18next : sa langue courante et l'évènement de son changement. */
interface LanguageSource {
  language?: string;
  on(event: "languageChanged", listener: (lang: string) => void): unknown;
}

/**
 * `<html lang>` suit la langue de l'interface (il restait à « en », la valeur d'index.html) :
 * un lecteur d'écran prononce dans la bonne langue, et la surcouche de mise à jour de la
 * coquille CEF — hors du front — y lit la sienne (vu : une notification en anglais sur une
 * interface en français).
 */
export function followDocumentLanguage(i18n: LanguageSource, root: { lang: string } = document.documentElement): void {
  const apply = (lang: string | undefined): void => {
    if (lang) root.lang = lang;
  };
  apply(i18n.language);
  i18n.on("languageChanged", apply);
}
