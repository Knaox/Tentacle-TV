/**
 * Octave — la pochette d'une sortie IMPORTÉE en tête de sa vue : demandée en 1200 px (`releaseArtSized`), et un
 * clic l'ouvre EN GRAND (taille d'origine, `full`) — l'image est ce qui compte le plus pour une sortie qu'aucun
 * catalogue n'a. Sans pochette : le repli habituel, rien à agrandir.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { releaseArtSized } from "@tentacle-tv/shared/music";
import { Modal } from "../../../components/ui/Modal";
import { Artwork } from "../components/Artwork";

const HEADER_ART = "h-44 w-44 shadow-[var(--oc-shadow-art-lg)] md:h-56 md:w-56";

export function ImportedCover({ url, title }: { url: string | null; title: string }) {
  const { t } = useTranslation("musicReleases");
  const [open, setOpen] = useState(false);
  if (!url) return <Artwork url={null} alt={title} label={title} radius="lg" className={HEADER_ART} eager />;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={title} className="shrink-0 cursor-zoom-in rounded-[var(--oc-radius-art-lg,14px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
        <Artwork url={releaseArtSized(url, "1200")} alt={title} label={title} radius="lg" className={HEADER_ART} eager />
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} maxWidth="min(92vw, 92vh)" label={title}>
          <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="block w-full cursor-zoom-out">
            <Artwork url={releaseArtSized(url, "full")} alt={title} label={title} radius="lg" className="aspect-square w-full" eager />
          </button>
        </Modal>
      )}
    </>
  );
}
