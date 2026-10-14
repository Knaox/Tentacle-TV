import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import { useAvatarUpload } from "../../../hooks/useAvatarUpload";
import { useAvatarGallery } from "../../../profiles/avatarGallery/useAvatarGallery";
import { AVATAR_GRADIENT_BG } from "../../../components/userMenu/menuItems";

/** Le serveur tel qu'on le reconnaît : son hôte, sans schéma ni chemin. */
export function serverHost(url: string): string {
  return url.replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "");
}

const SIZE = 76;

/**
 * `ProfileHero` + `ProfileAvatar` de l'app : photo 76 (repli : initiale 32 sur
 * dégradé de marque), pastille caméra 24 en bas à droite ; nom 22
 * extra-gras, hôte du serveur 13 tertiaire, badge « Administrateur ». Écart
 * 16, 20 sous l'en-tête. Toucher la photo ouvre la galerie des avatars du web
 * (`useAvatarGallery` : un personnage ou une photo importée, envoyés par
 * `useAvatarUpload` — Jellyfin, copie locale, repli en chaîne).
 */
export function ProfileHero({ name, initial, isAdmin, serverUrl }: {
  name: string;
  initial: string;
  isAdmin: boolean;
  serverUrl: string;
}) {
  const { t } = useTranslation("profile");
  const { avatarSrc, onAvatarError, avatarVersion, uploading, userId } = useAvatarUpload();
  const { openGallery, dialog: galleryDialog } = useAvatarGallery();
  const host = serverHost(serverUrl);

  return (
    <header className="mb-5 flex items-center gap-4">
      <button
        type="button"
        onClick={() => openGallery()}
        disabled={uploading || !userId}
        aria-label={t("changePhoto")}
        className="relative shrink-0 rounded-full active:opacity-85"
        style={{ width: SIZE, height: SIZE, WebkitTapHighlightColor: "transparent" }}
      >
        {avatarSrc ? (
          <img
            key={`${avatarVersion}-${avatarSrc}`}
            src={avatarSrc}
            alt=""
            className="h-full w-full rounded-full bg-fill-subtle object-cover"
            onError={onAvatarError}
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center rounded-full text-[32px] font-extrabold tracking-[-0.5px] text-cta-brand-fg"
            style={{ background: AVATAR_GRADIENT_BG, boxShadow: "0 6px 16px rgba(0,0,0,0.3)" }}
          >
            {initial}
          </span>
        )}
        {/* Affordance : la photo se change au toucher. */}
        <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface-0)] bg-[var(--brand)] text-cta-brand-fg">
          <Camera size={11} aria-hidden />
        </span>
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </span>
        )}
      </button>
      {galleryDialog}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="truncate text-[22px] font-extrabold tracking-[-0.4px] text-content-primary">{name}</h1>
        {host ? <p className="truncate text-[13px] text-content-tertiary">{host}</p> : null}
        {isAdmin ? (
          <span className="self-start rounded bg-[var(--brand-soft)] px-2 py-[3.5px] text-[10px] font-bold uppercase tracking-[0.3px] text-[var(--brand-light)]">
            {t("adminBadge")}
          </span>
        ) : null}
      </div>
    </header>
  );
}
