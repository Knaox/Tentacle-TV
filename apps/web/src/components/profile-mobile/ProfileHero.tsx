import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AVATAR_RING_STYLE } from "../userMenu/menuItems";
import { useAvatarUpload } from "../../hooks/useAvatarUpload";
import { useToast } from "../../contexts/ToastContext";

interface Props {
  name: string;
  initial: string;
  isAdmin: boolean;
}

/**
 * En-tête de la page Profile : avatar XL (photo Jellyfin, fallback initiale) +
 * nom + badge admin. L'avatar est cliquable : la photo choisie est envoyée à
 * Jellyfin (elle change donc aussi dans les autres clients Jellyfin).
 */
export function ProfileHero({ name, initial, isAdmin }: Props) {
  const { t } = useTranslation("profile");
  const { t: tNav } = useTranslation("nav");
  const { show } = useToast();
  const { avatarUrl, avatarVersion, uploading, upload, userId } = useAvatarUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const handleFile = async (file: File) => {
    const ok = await upload(file);
    if (ok) setImageFailed(false);
    show(ok ? "success" : "error", t(ok ? "avatarUpdated" : "avatarUpdateFailed"));
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <header className="flex items-center gap-4 px-1 pb-6">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading || !userId}
        aria-label={t("changePhoto")}
        title={t("changePhoto")}
        className="group relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-bold text-cta-brand-fg transition-transform duration-200 active:scale-95"
        style={AVATAR_RING_STYLE}
      >
        {avatarUrl && !imageFailed ? (
          <img
            key={avatarVersion}
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          initial
        )}
        {/* Scrim superposé à la photo d'avatar (conteneur absolute inset-0 au-dessus d'un <img>) :
            reste noir/blanc dans les deux thèmes, hors périmètre de la migration. */}
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {uploading ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <CameraIcon />
          )}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold text-content-primary">
          {name || t("defaultUsername")}
        </h1>
        {isAdmin ? (
          <span className="mt-2 inline-flex items-center rounded-full border border-[rgba(var(--brand-rgb),0.4)] bg-[rgba(var(--brand-rgb),0.15)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-light)]">
            {tNav("admin")}
          </span>
        ) : (
          <p className="mt-1 text-sm text-content-quaternary">{t("title")}</p>
        )}
      </div>
    </header>
  );
}

function CameraIcon() {
  // Icône affichée dans le scrim posé sur l'avatar (on-media) : reste blanche, hors périmètre.
  return (
    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
