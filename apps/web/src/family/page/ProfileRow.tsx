import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Lock } from "lucide-react";
import { guestCanRequest, type FamilyProfileDto, type ProfileActions } from "@tentacle-tv/shared";
import { FamilyAvatar } from "../FamilyAvatar";
import { useFamilyText } from "../useFamilyText";
import { RightToggle } from "./RightToggle";
import { SMALL_BUTTON, SMALL_DANGER_BUTTON } from "./familyUi";

interface ProfileRowProps {
  profile: FamilyProfileDto;
  last: boolean;
  /** Le profil de celui qui regarde (« Vous »). */
  isSelf: boolean;
  /** Ce que celui qui regarde peut faire sur ce profil (`profileActions`, shared). */
  actions: ProfileActions;
  /** Dire qui a créé cet invité : faux quand c'est le propriétaire (il va de soi). */
  showCreator: boolean;
  rightPending: boolean;
  onRemove: (profile: FamilyProfileDto) => void;
  onGuestPin: (profile: FamilyProfileDto) => void;
  /** Habiller un invité (galerie des avatars) ; absent : le serveur ne le sait pas, ou la session ne le peut pas. */
  onGuestPhoto?: (profile: FamilyProfileDto) => void;
  onRightChange: (profile: FamilyProfileDto, next: boolean) => void;
}

const KIND_KEY = { owner: "family:kindOwner", member: "family:kindMember", guest: "family:kindGuest" } as const;

/**
 * Un profil de LA famille, la même pour le propriétaire et pour ses membres :
 * avatar à sa couleur, nom, rôle, ancienneté, code PIN, créateur d'un invité,
 * et les droits — « Peut créer des invités » d'un membre, « Peut demander des
 * films » d'un invité (ses demandes partent à son propre nom) — que le
 * propriétaire règle et que les autres LISENT. Les boutons ne paraissent que pour les
 * gestes permis à celui qui regarde : retirer un membre, supprimer un invité,
 * poser son PIN ou changer sa photo — son rond s'ouvre alors sur la galerie
 * des avatars (le propriétaire, ou le membre qui l'a créé).
 */
export const ProfileRow = memo(function ProfileRow({
  profile, last, isSelf, actions, showCreator, rightPending, onRemove, onGuestPin, onGuestPhoto, onRightChange,
}: ProfileRowProps) {
  const { t } = useTranslation(["familyWeb", "family", "avatars"]);
  const { formatDate } = useFamilyText();
  const isGuest = profile.kind === "guest";
  // Mêmes droits que son PIN (`profileActions`, shared ; le serveur revérifie).
  const dressable = isGuest && actions.pin && onGuestPhoto !== undefined;
  const avatar = <FamilyAvatar userId={profile.userId} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={40} />;

  return (
    <li className={`flex flex-wrap items-start gap-3 px-4 py-3 ${last ? "" : "border-b border-line-subtle"}`}>
      {dressable ? (
        <button
          type="button"
          onClick={() => onGuestPhoto(profile)}
          aria-label={t("avatars:guest.change", { name: profile.name })}
          title={t("avatars:guest.change", { name: profile.name })}
          className="group relative flex-shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {avatar}
          {/* Pastille posée sur la photo : reste à la couleur de la marque dans les deux thèmes. */}
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--surface-1)] bg-[var(--brand)] text-cta-brand-fg transition-transform group-hover:scale-110">
            <Camera size={10} aria-hidden="true" />
          </span>
        </button>
      ) : (
        avatar
      )}
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-content-primary">{profile.name}</span>
          {isSelf && <span className="text-xs text-content-tertiary">· {t("familyWeb:owned.you")}</span>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-content-tertiary">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              isGuest ? "bg-[rgba(var(--brand-rgb),0.14)] text-[var(--brand-light)]" : "bg-fill-soft text-content-secondary"
            }`}
          >
            {t(KIND_KEY[profile.kind])}
          </span>
          {profile.since && <span>{t("familyWeb:owned.since", { date: formatDate(profile.since) })}</span>}
          {isGuest && showCreator && profile.createdByName && (
            <span>{t("family:addedBy", { name: profile.createdByName })}</span>
          )}
          {profile.hasPin && (
            <span className="inline-flex items-center gap-1">
              <Lock size={11} aria-hidden="true" />
              {t("familyWeb:owned.pinOn")}
            </span>
          )}
        </p>
        {profile.kind === "member" && (
          <RightToggle
            label={t("family:rights.createGuests")}
            hint={t("family:rights.createGuestsHint")}
            checked={profile.rights?.createGuests === true}
            editable={actions.right === "createGuests"}
            pending={rightPending}
            onChange={(next) => onRightChange(profile, next)}
          />
        )}
        {isGuest && profile.guestRights !== undefined && (
          <RightToggle
            label={t("family:rights.requestTitles")}
            hint={t("family:rights.requestTitlesHint")}
            checked={guestCanRequest(profile)}
            editable={actions.right === "requestTitles"}
            pending={rightPending}
            onChange={(next) => onRightChange(profile, next)}
          />
        )}
      </div>
      {(actions.pin || actions.remove) && (
        <div className="flex gap-2">
          {actions.pin && (
            <button type="button" onClick={() => onGuestPin(profile)} className={SMALL_BUTTON}
              aria-label={`${t("familyWeb:owned.setPin")} — ${profile.name}`}>
              <Lock size={13} aria-hidden="true" />
              {t("familyWeb:owned.setPin")}
            </button>
          )}
          {actions.remove && (
            <button type="button" onClick={() => onRemove(profile)} className={SMALL_DANGER_BUTTON}
              aria-label={`${t(isGuest ? "familyWeb:owned.delete" : "familyWeb:owned.remove")} — ${profile.name}`}>
              {t(isGuest ? "familyWeb:owned.delete" : "familyWeb:owned.remove")}
            </button>
          )}
        </div>
      )}
    </li>
  );
});
