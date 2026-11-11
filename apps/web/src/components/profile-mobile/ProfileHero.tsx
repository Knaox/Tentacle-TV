import { useTranslation } from "react-i18next";
import { CameraIcon } from "@phosphor-icons/react/dist/csr/Camera";
import { avatarRingStyleFor } from "../userMenu/menuItems";
import { useAccountFaceColor } from "../../profiles/face/useAccountFaceColor";
import { useAvatarUpload } from "../../hooks/useAvatarUpload";
import { useAvatarGallery } from "../../profiles/avatarGallery/useAvatarGallery";
import { useGuestSessionPhoto } from "../../profiles/avatarGallery/useGuestSessionPhoto";
import { useActiveProfile, type ActiveProfile } from "../../auth/profileSession";
import { FamilyAvatar } from "../../family/FamilyAvatar";

/** Le pictogramme du voile posé sur la photo (sur une image) : il reste blanc dans les deux thèmes. */
const CAMERA_ON_PHOTO = "h-6 w-6 text-white";

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
 * nom du profil — sans « Changer la photo », sauf pour un INVITÉ que la
 * session personnelle de l'appareil habille (serveur 1.30.0), comme dans le
 * menu de l'avatar.
 */
export function ProfileHero({ name, initial, isAdmin }: Props) {
  const { t } = useTranslation("profile");
  const { t: tNav } = useTranslation("nav");
  const { avatarSrc, onAvatarError, avatarVersion, uploading, userId } = useAvatarUpload();
  const { openGallery, dialog: galleryDialog } = useAvatarGallery();

  const activeProfile = useActiveProfile();
  // Bureau, famille : le rond à la couleur du profil du compte, comme sur « Qui regarde ? » ;
  // sans famille, l'encre.
  // Le rond du compte : la source est celle de la barre du haut et du menu (`avatarRingStyleFor`) — un seul visage.
  const ringStyle = avatarRingStyleFor(useAccountFaceColor());

  if (activeProfile) return <ProfileSessionHero profile={activeProfile} />;

  return (
    <header className="flex items-center gap-4 px-1 pb-6">
      <button
        type="button"
        onClick={() => openGallery()}
        disabled={uploading || !userId}
        aria-label={t("changePhoto")}
        title={t("changePhoto")}
        className="group relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-bold transition-transform duration-press ease-out active:scale-[var(--press-scale)] text-cta-brand-fg"
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
        {/* Voile superposé à la photo d'avatar (conteneur absolute inset-0 au-dessus d'un <img>) :
            reste noir/blanc dans les deux thèmes. */}
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity duration-hover group-hover:opacity-100">
          {uploading ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <CameraIcon aria-hidden className={CAMERA_ON_PHOTO} />
          )}
        </span>
      </button>
      {galleryDialog}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-heading-1 text-content-primary">
          {name || t("defaultUsername")}
        </h1>
        {isAdmin ? (
          <span className="chip chip-accent mt-2">
            {tNav("admin")}
          </span>
        ) : (
          <p className="mt-1 text-sm text-content-tertiary">{t("title")}</p>
        )}
      </div>
    </header>
  );
}

/** L'en-tête pendant la session d'un profil : son rond, son nom, ce qu'il est ;
 *  un invité que l'appareil habille touche son rond pour changer sa photo. */
function ProfileSessionHero({ profile }: { profile: ActiveProfile }) {
  const { t } = useTranslation(["profilePicker", "profile"]);
  const guestTarget = useGuestSessionPhoto();
  const { openGallery, dialog: galleryDialog } = useAvatarGallery();
  const avatar = <FamilyAvatar userId={profile.id} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={80} />;
  return (
    <header className="flex items-center gap-4 px-1 pb-6">
      {guestTarget ? (
        <button
          type="button"
          onClick={() => openGallery(guestTarget)}
          aria-label={t("profile:changePhoto")}
          title={t("profile:changePhoto")}
          className="group relative flex-shrink-0 rounded-full transition-transform duration-press ease-out active:scale-[var(--press-scale)]"
        >
          {avatar}
          {/* Voile superposé à la photo : reste noir/blanc dans les deux thèmes. */}
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity duration-hover group-hover:opacity-100">
            <CameraIcon aria-hidden className={CAMERA_ON_PHOTO} />
          </span>
        </button>
      ) : (
        avatar
      )}
      {galleryDialog}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-heading-1 text-content-primary">{profile.name}</h1>
        <p className="mt-1 text-sm text-content-tertiary">
          {profile.kind === "guest" ? t("profilePicker:session.guestBadge") : t("profilePicker:session.memberBadge")}
        </p>
      </div>
    </header>
  );
}
