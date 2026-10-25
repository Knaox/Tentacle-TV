/**
 * L'entrée vers la musique GARDÉE, dans l'accueil hors ligne de Tentacle
 * (`downloads/OfflineCatalog.tsx`) : sans réseau, la bascule d'Octave se tait
 * (elle demande le serveur) — sans cette entrée, la musique gardée serait
 * introuvable. Le compte de l'appareil seulement, une ligne de montage.
 */

import { Music } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useActiveProfile } from "../../../auth/profileSession";
import { supportsMusicOffline } from "../../../desktop/capabilities";
import { octavePaths } from "../octavePaths";
import { useKeptMusic } from "./useKeptMusic";

export function OfflineMusicEntry() {
  const profileSession = useActiveProfile() !== null;
  if (!supportsMusicOffline() || profileSession) return null;
  return <OfflineMusicEntryCard />;
}

function OfflineMusicEntryCard() {
  const { t } = useTranslation("musicOffline");
  const navigate = useNavigate();
  const kept = useKeptMusic();
  const playable = kept.tracks.filter((k) => k.status === "complete").length;
  if (playable === 0) return null;
  return (
    <div className="px-4 md:px-8">
      <button
        type="button"
        onClick={() => navigate(octavePaths.device)}
        className="flex w-full max-w-xl cursor-pointer items-center gap-4 rounded-2xl border border-line-subtle bg-fill-faint p-4 text-left transition-colors duration-150 hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--brand-dark),var(--brand-accent))] text-white" aria-hidden>
          <Music className="h-7 w-7" />
        </span>
        <span className="min-w-0">
          <span className="block text-base font-semibold text-content-primary">{t("entry.title")}</span>
          <span className="block text-sm text-content-tertiary">{t("entry.subtitle", { count: playable })}</span>
        </span>
      </button>
    </div>
  );
}
