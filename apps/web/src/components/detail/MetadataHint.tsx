import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Info, RefreshCw } from "lucide-react";
import {
  libraryRescanErrorCode,
  useAdminMetadataStatus,
  useJellyfinClient,
  useLibraryRescan,
  useMetadataArrival,
  useServerCapability,
} from "@tentacle-tv/api-client";
import { lacksMetadata, type MediaItem } from "@tentacle-tv/shared";
import { getUserInfo } from "../userMenu/menuItems";
import { fadeUp } from "../../theme/motion";

/**
 * Le message discret d'un titre que Jellyfin n'a pas (encore) trouvé — règle
 * partagée `lacksMetadata` — sur la fiche du bureau et du miroir : jamais un
 * écran vide, jamais un blocage, le titre se regarde déjà.
 *
 * Un ADMINISTRATEUR (session personnelle : le web l'est toujours ; un compte
 * « vu en tant que » n'est pas administrateur) a « Réanalyser maintenant »,
 * face à un serveur qui déclare `admin.libraryRescan`, et le conseil de ce
 * qui empêche Jellyfin de trouver. La fiche se met à jour seule à l'arrivée
 * des métadonnées (`useMetadataArrival`).
 *
 * Le téléviseur LG a son pendant, texte seul (`MetadataHintTv`).
 */

/** La section « Réglages de Jellyfin » de l'administration (`JELLYFIN_SETUP_ANCHOR`). */
const JELLYFIN_SETTINGS_PATH = "/admin/services#jellyfin-setup";

export const MetadataHint = memo(function MetadataHint({ item, tone = "media" }: {
  item: MediaItem;
  /** `media` : posé sur la scène (bureau) ; `page` : sur le fond de page (miroir). */
  tone?: "media" | "page";
}) {
  const { t } = useTranslation("metadataHint");
  const client = useJellyfinClient();
  const lacking = lacksMetadata(item);
  const storedToken = typeof localStorage === "undefined" ? null : localStorage.getItem("tentacle_token");
  useMetadataArrival(item, { token: client.getAccessToken() || storedToken });
  const canRescan = useServerCapability("admin.libraryRescan");
  const isAdmin = getUserInfo().isAdmin;
  if (!lacking) return null;

  const onMedia = tone === "media";
  return (
    <motion.div
      variants={fadeUp}
      role="note"
      data-metadata-hint
      // `lg-content` : sous le verre de macOS 26, le panneau de la maquette,
      // givré (posé sur l'image de la fiche) — marqueurs sans style ailleurs.
      className={`lg-content lg-content-frosted mt-5 max-w-2xl rounded-xl border px-4 py-3 text-sm leading-relaxed ${
        onMedia
          ? "border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.5)] text-on-media-secondary"
          : "border-line-subtle bg-fill-faint text-content-secondary"
      }`}
    >
      <p className="flex gap-2.5">
        <Info size={16} aria-hidden className="mt-0.5 flex-shrink-0 opacity-80" />
        <span>{t("body")}</span>
      </p>
      {isAdmin && canRescan && <AdminRescan item={item} onMedia={onMedia} />}
    </motion.div>
  );
});

function AdminRescan({ item, onMedia }: { item: MediaItem; onMedia: boolean }) {
  const { t } = useTranslation("metadataHint");
  const rescan = useLibraryRescan();
  const tmdb = useAdminMetadataStatus({ enabled: true });
  const linkClass = `underline underline-offset-2 ${onMedia ? "hover:text-on-media-primary" : "hover:text-content-primary"}`;
  const started = rescan.isSuccess;

  return (
    <div className="mt-3 pl-[26px]">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => rescan.mutate(item)}
          disabled={rescan.isPending || started}
          className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:cursor-default disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${
            onMedia
              ? "border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.55)] text-on-media-primary hover:bg-[rgba(var(--scrim-media-rgb),0.7)]"
              : "border-line-subtle bg-fill-soft text-content-primary hover:bg-fill-medium"
          }`}
        >
          <RefreshCw size={14} aria-hidden className={rescan.isPending ? "animate-spin motion-reduce:animate-none" : undefined} />
          {rescan.isPending ? t("rescanning") : t("rescan")}
        </button>
        <span aria-live="polite" className="min-w-0 flex-1 text-xs">
          {started ? t("rescanStarted") : rescan.isError ? t(`rescanError_${libraryRescanErrorCode(rescan.error)}`) : null}
        </span>
      </div>
      <p className="mt-2 text-xs opacity-90">
        {t("adminTip")}{" "}
        <Link to={JELLYFIN_SETTINGS_PATH} className={linkClass}>{t("adminTipJellyfin")}</Link>
        {tmdb.data && !tmdb.data.tmdb.configured && (
          <>
            {" · "}
            <Link to="/admin/metadata" className={linkClass}>{t("adminTipTmdbKey")}</Link>
          </>
        )}
      </p>
    </div>
  );
}
