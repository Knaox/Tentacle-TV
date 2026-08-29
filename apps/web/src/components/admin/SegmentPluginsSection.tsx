import { useTranslation } from "react-i18next";
import { cls } from "../../pages/adminUtils";

/**
 * Où le serveur trouve les passages d'un épisode — et comment lui en donner.
 *
 * Tentacle ne détecte RIEN : il lit ce que Jellyfin publie (`MediaSegments`,
 * les greffons historiques, à défaut les chapitres nommés). Sans greffon de
 * détection, aucun bouton de saut ne paraîtra jamais, quel que soit le réglage
 * côté client — d'où cette section, qui est une carte au trésor plus qu'un
 * réglage : elle ne fait que MONTRER les greffons connus.
 *
 * Ils s'EMPILENT : chacun signale ce qu'il sait, et le résolveur prend le plus
 * précis. En installer deux ne crée pas de conflit.
 */

interface Plugin {
  key: string;
  nom: string;
  url: string;
}

const PLUGINS: readonly Plugin[] = [
  { key: "introSkipper", nom: "Intro Skipper", url: "https://github.com/intro-skipper/intro-skipper" },
  { key: "chapterSegments", nom: "Chapter Segments", url: "https://github.com/jellyfin/jellyfin-plugin-chapter-segments" },
  { key: "introDb", nom: "TheIntroDB", url: "https://github.com/TheIntroDB/jellyfin-plugin" },
  { key: "skipmeDb", nom: "skipme.db", url: "https://github.com/intro-skipper/skipme.db-plugin" },
];

export function SegmentPluginsSection() {
  const { t } = useTranslation("admin");

  return (
    <div className={cls.card}>
      <h2 className="mb-1 text-lg font-semibold text-content-primary">{t("segmentPlugins")}</h2>
      <p className="mb-4 text-sm text-content-quaternary">{t("segmentPluginsDescription")}</p>
      <div className={cls.sub}>
        <ul className="space-y-2">
          {PLUGINS.map((plugin) => (
            <li key={plugin.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <a
                href={plugin.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-content-primary underline decoration-line-subtle underline-offset-4 hover:decoration-current"
              >
                {plugin.nom}
              </a>
              <span className="text-xs text-content-quaternary">
                {t(`segmentPlugin_${plugin.key}`)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-content-quaternary">{t("segmentPluginsScanHelp")}</p>
      </div>
    </div>
  );
}
