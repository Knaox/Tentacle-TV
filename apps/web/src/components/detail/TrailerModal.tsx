import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/Modal";
import { ModalHeader } from "../ui/ModalHeader";
import { ExternalLinkIcon } from "../media/MediaDetailIcons";
import { parseYouTubeId, youtubeEmbedSrc } from "./youtube";

interface RemoteTrailer {
  Url: string;
  Name?: string;
}

interface TrailerModalProps {
  open: boolean;
  onClose: () => void;
  trailers: RemoteTrailer[];
  /** Index du trailer à afficher à l'ouverture (celui sur lequel on a cliqué). */
  initialIndex?: number;
}

/**
 * Modale d'embed des bandes-annonces distantes (YouTube).
 *
 * Embed via `youtube-nocookie.com`. Un lien « Ouvrir sur YouTube » est TOUJOURS
 * présent : repli robuste quand l'embed est bloqué (embedding désactivé, âge,
 * géo) — on n'essaie pas de détecter l'échec (non fiable), l'utilisateur a
 * toujours une sortie. Les URL non-YouTube affichent uniquement le lien externe.
 */
export function TrailerModal({ open, onClose, trailers, initialIndex = 0 }: TrailerModalProps) {
  const { t } = useTranslation("common");
  const [index, setIndex] = useState(initialIndex);

  // Réinitialise sur le trailer cliqué à chaque ouverture (sinon l'index reste
  // figé sur la sélection précédente → on lançait toujours le même trailer).
  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  const current = trailers[index] ?? trailers[0];
  if (!current) return null;

  const ytId = parseYouTubeId(current.Url);
  const title = current.Name || t("common:trailer");

  return (
    <Modal open={open} onClose={onClose} maxWidth={880} labelledBy="trailer-title">
      <ModalHeader title={title} onClose={onClose} titleId="trailer-title" />
      <div className="p-4">
        {ytId ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
            <iframe
              key={current.Url}
              src={youtubeEmbedSrc(ytId)}
              title={title}
              className="absolute inset-0 h-full w-full"
              // YouTube refuse l'embed sans Referer (erreur 153). En prod le header
              // Referrer-Policy: no-referrer (Helmet) le supprime → on force l'envoi
              // de l'origine pour CETTE iframe (l'attribut prime sur la politique doc).
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-black/60 px-6 text-center text-sm text-white/60">
            {t("common:trailerUnavailable")}
          </div>
        )}

        <a
          href={current.Url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:border-white/50 hover:text-white"
        >
          <ExternalLinkIcon /> {t("common:openOnYoutube")}
        </a>

        {trailers.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {trailers.map((tr, i) => (
              <button
                key={tr.Url}
                type="button"
                onClick={() => setIndex(i)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === index
                    ? "border-[var(--brand)]/45 bg-[var(--brand-soft)] text-[var(--brand-light)]"
                    : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                }`}
              >
                {tr.Name || `${t("common:trailer")} ${i + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
