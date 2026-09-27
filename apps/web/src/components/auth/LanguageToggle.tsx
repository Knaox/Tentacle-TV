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
      className="flex rounded-full border border-line-subtle bg-fill-faint p-0.5"
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
            className={`min-h-9 min-w-11 cursor-pointer rounded-full px-3 text-xs font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
              active
                ? "bg-[var(--brand-soft)] text-[var(--brand-light)]"
                : "text-content-tertiary hover:text-content-primary"
            }`}
          >
            {lng.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
