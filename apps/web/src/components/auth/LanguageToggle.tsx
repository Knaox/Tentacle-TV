import { useTranslation } from "react-i18next";

const LANGUAGES = ["fr", "en"] as const;

/**
 * Le choix de langue des écrans d'avant connexion : il n'y a pas encore de
 * préférences à ouvrir, c'est donc ici qu'on change de langue. La clé de
 * stockage `tentacle_language` est celle que lit le démarrage — ne pas la
 * renommer.
 */
export function LanguageToggle() {
  const { t, i18n } = useTranslation("auth");
  const current = i18n.language?.startsWith("fr") ? "fr" : "en";

  const select = (lng: string) => {
    void i18n.changeLanguage(lng);
    localStorage.setItem("tentacle_language", lng);
  };

  return (
    <div
      role="group"
      aria-label={t("language")}
      className="flex gap-0.5 rounded-pill bg-surface-2 p-[3px]"
    >
      {LANGUAGES.map((lng) => {
        const active = current === lng;
        return (
          <button
            key={lng}
            type="button"
            lang={lng}
            aria-pressed={active}
            onClick={() => select(lng)}
            className={`h-8 min-w-11 rounded-pill px-3 text-xs font-semibold tracking-wide transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
              active ? "bg-surface-4 text-content-primary" : "text-content-tertiary hover:text-content-primary"
            }`}
          >
            {lng.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
