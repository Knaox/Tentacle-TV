import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Lock, ShieldCheck, UserCog, Library } from "lucide-react";
import {
  guestCanRequest,
  hasParentalControl,
  isFamilyParent,
  type FamilyProfileDto,
  type ProfileActions,
  type ProfileRoleActions,
} from "@tentacle-tv/shared";
import { guestParentalOf, hasGuestParental } from "../../components/parental/guestParental";
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
  /** Le rôle de parent et le contrôle parental d'un membre (`profileRoleActions`, shared ; 1.30.0). Absent : aucun. */
  roleActions?: ProfileRoleActions;
  /** Dire qui a créé cet invité : faux quand c'est le propriétaire (il va de soi). */
  showCreator: boolean;
  rightPending: boolean;
  onRemove: (profile: FamilyProfileDto) => void;
  onGuestPin: (profile: FamilyProfileDto) => void;
  /** Habiller un invité (galerie des avatars) ; absent : le serveur ne le sait pas, ou la session ne le peut pas. */
  onGuestPhoto?: (profile: FamilyProfileDto) => void;
  /** Régler le contrôle parental d'un invité ; absent : le serveur ne le sait pas, ou la session ne le peut pas. */
  onGuestParental?: (profile: FamilyProfileDto) => void;
  onRightChange: (profile: FamilyProfileDto, next: boolean) => void;
  /** Nommer ce membre parent, ou le lui retirer ; absent : le serveur ne le sait pas. */
  onRoleChange?: (profile: FamilyProfileDto, parent: boolean) => void;
  /** Régler le contrôle parental d'un membre mineur ; absent : le serveur ne le sait pas. */
  onMemberParental?: (profile: FamilyProfileDto) => void;
  /** Ses bibliothèques (1.30.0, `family.libraryLimits`), mêmes droits que son contrôle parental ;
   *  absent : le serveur ne le sait pas, ou la session ne le peut pas. */
  onLibraries?: (profile: FamilyProfileDto) => void;
}

const KIND_KEY = { owner: "family:kindOwner", member: "family:kindMember", guest: "family:kindGuest" } as const;
const NO_ROLE_ACTIONS: ProfileRoleActions = { role: false, roleBlockedByParental: false, memberParental: false };

/**
 * Un profil de LA famille, la même pour le propriétaire et pour ses membres :
 * avatar à sa couleur, nom, rôle, ancienneté, code PIN, créateur d'un invité,
 * et les droits — « Peut créer des invités » d'un membre, « Peut demander des
 * films » d'un invité (ses demandes partent à son propre nom) — que le
 * propriétaire règle et que les autres LISENT. Les boutons ne paraissent que pour les
 * gestes permis à celui qui regarde : retirer un membre, supprimer un invité,
 * poser son PIN ou changer sa photo — son rond s'ouvre alors sur la galerie
 * des avatars (le propriétaire, ou le membre qui l'a créé) —, et régler son
 * contrôle parental, avec les mêmes droits que son PIN. 1.30.0 : un membre
 * PARENT porte son rôle ; le propriétaire le nomme d'un interrupteur, et le
 * propriétaire ou un parent règle le contrôle parental d'un membre mineur.
 */
export const ProfileRow = memo(function ProfileRow({
  profile, last, isSelf, actions, roleActions = NO_ROLE_ACTIONS, showCreator, rightPending, onRemove, onGuestPin, onGuestPhoto, onGuestParental, onRightChange,
  onRoleChange, onMemberParental, onLibraries,
}: ProfileRowProps) {
  const { t } = useTranslation(["familyWeb", "family", "avatars"]);
  const { formatDate } = useFamilyText();
  const isGuest = profile.kind === "guest";
  const suspended = isGuest && profile.guestRights?.suspended === true;
  // Mêmes droits que son PIN (`profileActions`, shared ; le serveur revérifie).
  const dressable = isGuest && actions.pin && onGuestPhoto !== undefined;
  const parentalEditable = isGuest && actions.pin && onGuestParental !== undefined;
  const parent = isFamilyParent(profile);
  const memberParental = roleActions.memberParental && onMemberParental !== undefined;
  const librariesEditable = onLibraries !== undefined && ((isGuest && actions.pin) || roleActions.memberParental);
  const parentalOn = isGuest ? hasGuestParental(guestParentalOf(profile)) : hasParentalControl(profile);
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
            {parent ? (
              <span className="inline-flex items-center gap-1">
                <UserCog size={11} aria-hidden="true" />
                {t("family:kindParent")}
              </span>
            ) : (
              t(KIND_KEY[profile.kind])
            )}
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
          {parentalOn && (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={11} aria-hidden="true" />
              {t("familyWeb:parental.on")}
            </span>
          )}
        </p>
        {/* Les gestes sous les badges, jamais à côté : une rangée de quatre boutons écrasait
            la colonne du nom et de ses droits en un ruban d'un mot par ligne. */}
        {(actions.pin || actions.remove || memberParental || librariesEditable) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {memberParental && (
              <button type="button" onClick={() => onMemberParental(profile)} className={SMALL_BUTTON}
                aria-label={`${t("familyWeb:parental.open")} — ${profile.name}`}>
                <ShieldCheck size={13} aria-hidden="true" />
                {t("familyWeb:parental.open")}
              </button>
            )}
            {parentalEditable && (
              <button type="button" onClick={() => onGuestParental(profile)} className={SMALL_BUTTON}
                aria-label={`${t("familyWeb:parental.open")} — ${profile.name}`}>
                <ShieldCheck size={13} aria-hidden="true" />
                {t("familyWeb:parental.open")}
              </button>
            )}
            {librariesEditable && (
              <button type="button" onClick={() => onLibraries(profile)} className={SMALL_BUTTON}
                aria-label={`${t("familyWeb:libraries.open")} — ${profile.name}`}>
                <Library size={13} aria-hidden="true" />
                {t("familyWeb:libraries.open")}
              </button>
            )}
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
        {profile.kind === "member" && roleActions.role && onRoleChange && (
          <RightToggle
            label={t("familyWeb:roles.parent")}
            hint={roleActions.roleBlockedByParental ? t("familyWeb:roles.parentBlocked") : t("familyWeb:roles.parentHint")}
            checked={parent}
            editable
            pending={rightPending || roleActions.roleBlockedByParental}
            onChange={(next) => onRoleChange(profile, next)}
          />
        )}
        {profile.kind === "member" && !parent && (
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
            // 1.30.0 : cochée, mais l'administration ne le permet plus — gardée, sans effet.
            hint={t(suspended ? "family:rights.requestTitlesSuspended" : "family:rights.requestTitlesHint")}
            checked={guestCanRequest(profile)}
            editable={actions.right === "requestTitles"}
            pending={rightPending}
            onChange={(next) => onRightChange(profile, next)}
          />
        )}
        {suspended && actions.right !== "requestTitles" && (
          <p className="mt-1 text-xs text-content-tertiary">
            {t("family:rights.requestTitles")} — {t("family:rights.requestTitlesSuspended")}
          </p>
        )}
      </div>
    </li>
  );
});
