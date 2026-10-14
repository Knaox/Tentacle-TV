import { useTranslation } from "react-i18next";
import { avatarRingStyleFor } from "../userMenu/menuItems";
import { useAccountFaceColor } from "../../profiles/face/useAccountFaceColor";
import { useAvatarUpload } from "../../hooks/useAvatarUpload";
import { useAvatarGallery } from "../../profiles/avatarGallery/useAvatarGallery";
import { useActiveProfile, type ActiveProfile } from "../../auth/profileSession";
import { FamilyAvatar } from "../../family/FamilyAvatar";

interface Props {
  name: string;
  initial: string;
  isAdmin: boolean;
}

/**
 * En-tête de la page Profile : avatar XL (photo Jellyfin, fallback initiale) +
 * nom + badge admin. L'avatar est cliquable : il ouvre la galerie des avatars
 * (`useAvatarGallery`) — un personnage ou une photo importée, envoyés à
 * Jellyfin (la photo change donc aussi dans les autres clients Jellyfin).
 *
 * Bureau, session d'un PROFIL de la famille (fenêtre étroite) : le rond et le
 * nom du profil, sans « Changer la photo » — le serveur le refuse à un profil,
 * comme le menu de l'avatar le tait déjà.
 */
export function ProfileHero({ name, initial, isAdmin }: Props) {
  const { t } = useTranslation("profile");
  const { t: tNav } = useTranslation("nav");
  const { avatarSrc, onAvatarError, avatarVersion, uploading, userId } = useAvatarUpload();
  const { openGallery, dialog: galleryDialog } = useAvatarGallery();

  const activeProfile = useActiveProfile();
  // Bureau, famille : le rond à la couleur du profil du compte, comme sur « Qui regarde ? ».
  const ringStyle = avatarRingStyleFor(useAccountFaceColor());

  if (activeProfile) return <ProfileSessionHero profile={activeProfile} />;

  return (
    <header className="flex items-center gap-4 px-1 pb-6">
      <button
        type="button"
        onClick={openGallery}
        disabled={uploading || !userId}
        aria-label={t("changePhoto")}
        title={t("changePhoto")}
        className="group relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-bold text-cta-brand-fg transition-transform duration-200 active:scale-95"
        style={ringStyle}
      >
        {/* `avatarSrc` retombe tout seul sur la copie locale hors ligne, puis
            sur l'initiale s'il n'y en a aucune (cf. `useAvatarUpload`). */}
        {avatarSrc ? (
          <img
            key={`${avatarVersion}-${avatarSrc}`}
            src={avatarSrc}
            alt=""
            className="h-full w-full object-cover"
            onError={onAvatarError}
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
      {galleryDialog}
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

/** L'en-tête pendant la session d'un profil : son rond, son nom, ce qu'il est — rien à changer. */
function ProfileSessionHero({ profile }: { profile: ActiveProfile }) {
  const { t } = useTranslation("profilePicker");
  return (
    <header className="flex items-center gap-4 px-1 pb-6">
      <FamilyAvatar userId={profile.id} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={80} />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold text-content-primary">{profile.name}</h1>
        <p className="mt-1 text-sm text-content-quaternary">
          {profile.kind === "guest" ? t("session.guestBadge") : t("session.memberBadge")}
        </p>
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
