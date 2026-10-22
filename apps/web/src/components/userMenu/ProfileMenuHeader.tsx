import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import type { ActiveProfile } from "../../auth/profileSession";
import { FamilyAvatar } from "../../family/FamilyAvatar";

interface ProfileMenuHeaderProps {
  profile: ActiveProfile;
  /** Un invité que l'appareil peut habiller (serveur 1.30.0) : son rond ouvre la galerie. */
  onChangePhoto?: () => void;
}

/**
 * L'en-tête du menu de l'avatar pendant la SESSION D'UN PROFIL (bureau) : son
 * rond, son nom, et ce qu'il est — « Profil invité », « Profil de la
 * famille ». Un profil ouvert sur cet ordinateur ne touche pas au compte
 * Jellyfin ; seul un INVITÉ que la session personnelle de l'appareil gère peut
 * changer sa photo (le serveur la pose : `setGuestPhoto`). Sans filet : le
 * bloc d'identité (`UserAvatarMenu`) le trace sous « Changer de profil ».
 */
export const ProfileMenuHeader = memo(function ProfileMenuHeader({ profile, onChangePhoto }: ProfileMenuHeaderProps) {
  const { t } = useTranslation(["profilePicker", "profile"]);
  const avatar = <FamilyAvatar userId={profile.id} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={44} />;
  return (
    <div className="lg-menu-header flex items-center gap-3 px-4 py-3">
      {onChangePhoto ? (
        <button
          type="button"
          onClick={onChangePhoto}
          aria-label={t("profile:changePhoto")}
          title={t("profile:changePhoto")}
          className="group relative flex-shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {avatar}
          {/* Pastille posée sur la photo : reste à la couleur de la marque dans les deux thèmes. */}
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--surface-modal)] bg-[var(--brand)] text-cta-brand-fg transition-transform group-hover:scale-110">
            <Camera size={10} aria-hidden="true" />
          </span>
        </button>
      ) : (
        avatar
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-content-primary">{profile.name}</p>
        <p className="text-xs text-content-quaternary">
          {profile.kind === "guest" ? t("profilePicker:session.guestBadge") : t("profilePicker:session.memberBadge")}
        </p>
      </div>
    </div>
  );
});
