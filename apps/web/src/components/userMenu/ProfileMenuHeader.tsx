import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { ActiveProfile } from "../../auth/profileSession";
import { FamilyAvatar } from "../../family/FamilyAvatar";

/**
 * L'en-tête du menu de l'avatar pendant la SESSION D'UN PROFIL (bureau) : son
 * rond, son nom, et ce qu'il est — « Profil invité », « Profil de la
 * famille ». Pas de photo à changer : un profil ouvert sur cet ordinateur ne
 * touche pas au compte Jellyfin (le serveur le refuse).
 */
export const ProfileMenuHeader = memo(function ProfileMenuHeader({ profile }: { profile: ActiveProfile }) {
  const { t } = useTranslation("profilePicker");
  return (
    <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
      <FamilyAvatar userId={profile.id} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-content-primary">{profile.name}</p>
        <p className="text-xs text-content-quaternary">
          {profile.kind === "guest" ? t("session.guestBadge") : t("session.memberBadge")}
        </p>
      </div>
    </div>
  );
});
