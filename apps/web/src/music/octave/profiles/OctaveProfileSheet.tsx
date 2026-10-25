/**
 * Octave — « Qui écoute ? » : changer de profil SANS quitter la musique. Une
 * petite feuille (pas l'écran plein de « Qui regarde ? », ni son rideau) : les
 * profils de la famille, puis, sur place, le pavé du code PIN de celui qu'on
 * choisit. Le profil actuel referme la feuille sans rien changer ; un autre
 * s'ouvre par le serveur (`useOctavePick`) et la page d'Octave où l'on était
 * repart à son nom.
 */

import { memo, useCallback, useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { sameUserId, type PickerProfileDto } from "@tentacle-tv/shared";
import { Modal } from "../../../components/ui/Modal";
import { FamilyAvatar } from "../../../family/FamilyAvatar";
import { orderedProfiles, pickerProfileOf } from "../../../profiles/launch/pickerModel";
import { ProfilePinPad } from "../../../profiles/picker/ProfilePinPad";
import type { PickerProfile } from "../../../profiles/picker/pickerTypes";
import { useOctavePick } from "./useOctavePick";

interface OctaveProfileSheetProps {
  profiles: readonly PickerProfileDto[];
  /** Le profil de la session en cours (`switchActiveId`). */
  currentId: string | null;
  onClose: () => void;
  onStale: () => void;
}

export const OctaveProfileSheet = memo(function OctaveProfileSheet({ profiles, currentId, onClose, onStale }: OctaveProfileSheetProps) {
  const { t, i18n } = useTranslation(["octaveShell", "profilePicker"]);
  const titleId = useId();
  const { flow, pad } = useOctavePick({ profiles, onStale });
  const { choose, back } = flow;

  // Les tuiles de « Qui regarde ? », mêmes règles : SON profil en tête, cadenas, blocage, profil actuel.
  const choices = useMemo(
    () => orderedProfiles(profiles).map((profile) => pickerProfileOf(profile, Date.now(), i18n.language, t, currentId)),
    [profiles, currentId, i18n.language, t],
  );

  const pick = useCallback((id: string) => {
    if (currentId !== null && sameUserId(id, currentId)) {
      onClose();
      return;
    }
    choose(id);
  }, [currentId, choose, onClose]);

  return (
    <Modal open onClose={pad ? back : onClose} maxWidth={pad ? 360 : 440} labelledBy={pad ? undefined : titleId} label={pad ? t("profilePicker:pin.title", { name: pad.profile.name }) : undefined}>
      {pad ? (
        <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-7" data-octave-pin-sheet>
          <ProfilePinPad pad={pad} onDigit={flow.digit} onErase={flow.erase} onBack={back} />
          <button type="button" onClick={back} className={secondaryButton}>
            {t("profilePicker:pin.back")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-5" data-octave-profile-sheet>
          <div>
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">{t("profile.whoListens")}</h2>
            <p className="mt-1 text-sm text-content-tertiary">{t("profile.choose")}</p>
          </div>
          <ul className="grid grid-cols-3 gap-2">
            {choices.map((profile) => (
              <li key={profile.id}>
                <ProfileChoice profile={profile} opening={flow.opening !== null && sameUserId(flow.opening, profile.id)} disabled={flow.opening !== null} onPick={pick} />
              </li>
            ))}
          </ul>
          {flow.notice && <p role="status" className="text-sm text-status-error-fg">{flow.notice}</p>}
          <button type="button" onClick={onClose} className={`${secondaryButton} self-end`}>
            {t("profile.close")}
          </button>
        </div>
      )}
    </Modal>
  );
});

const secondaryButton =
  "min-h-[44px] rounded-full px-5 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

function ProfileChoice({ profile, opening, disabled, onPick }: { profile: PickerProfile; opening: boolean; disabled: boolean; onPick: (id: string) => void }) {
  const { t } = useTranslation(["octaveShell", "profilePicker"]);
  const label = profile.current
    ? t("profilePicker:tileLabelCurrent", { name: profile.name })
    : profile.pinLock
      ? t("profilePicker:tileLabelPin", { name: profile.name })
      : t("profilePicker:tileLabel", { name: profile.name });
  const caption = profile.lockedLabel ?? (profile.current ? t("profile.current") : profile.guest ? t("profile.guest") : null);
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={profile.current ? "true" : undefined}
      disabled={disabled}
      onClick={() => onPick(profile.id)}
      className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-default ${opening ? "bg-octave-hover" : ""} ${disabled && !opening ? "opacity-50" : ""}`}
    >
      <span className={`relative rounded-full ${profile.current ? "ring-2 ring-octave-accent-text ring-offset-2 ring-offset-[var(--oc-ink-raised)]" : ""}`}>
        <FamilyAvatar userId={profile.id} name={profile.name} color={profile.color} imageTag={profile.imageTag} size={56} />
        {profile.pinLock && (
          <span aria-hidden className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-octave-raised text-content-secondary">
            <Lock size={11} strokeWidth={2.4} />
          </span>
        )}
      </span>
      <span className="w-full truncate text-sm font-semibold text-content-primary">{profile.name}</span>
      {caption && <span className="-mt-1.5 w-full truncate text-[11px] text-content-tertiary">{caption}</span>}
    </button>
  );
}
