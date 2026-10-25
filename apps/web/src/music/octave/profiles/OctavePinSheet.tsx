/**
 * Octave — LA petite feuille du code PIN : ouvrir UN profil de la famille sans
 * quitter la musique. Export STABLE (contrat `pin-sheet.md` du lot) : la
 * coquille l'ouvre depuis le menu du profil, le démarrage d'Octave l'ouvre
 * quand la dernière identité utilisée ici exige son code — jamais « Qui
 * regarde ? » plein écran, jamais le rideau ni l'arrivée.
 *
 * Montée, elle CHOISIT le profil : son pavé s'il a un code (ou s'il est
 * bloqué), sinon l'ouverture tout de suite. Le serveur seul dit juste, faux
 * (essais restants) ou bloqué (`usePickFlow`) ; juste, la bascule recharge la
 * page d'Octave où l'on était (`useOctavePick`). Un refus (profil retiré,
 * familles coupées, serveur muet) se dit dans la feuille.
 *
 * Sans `onCancel`, elle ne se referme pas (Échap, voile et « Annuler »
 * absents) : au démarrage, il n'y a rien dessous où revenir.
 */

import { memo, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { PickerProfileDto } from "@tentacle-tv/shared";
import { Modal } from "../../../components/ui/Modal";
import { ProfilePinPad } from "../../../profiles/picker/ProfilePinPad";
import type { CommitResult } from "../../../profiles/switch/commitPick";
import { useOctavePick } from "./useOctavePick";

export interface OctavePinSheetProps {
  /** Le profil à ouvrir, tel que la liste de « Qui regarde ? » le donne. */
  profile: PickerProfileDto;
  /** Refermer sans rien ouvrir ; absent : la feuille ne se referme pas. */
  onCancel?: () => void;
  /** La bascule est faite : « stay » (son profil, sans rechargement) ou « reload » (la page repart). */
  onOpened?: (result: CommitResult) => void;
  /** La liste a changé (profil retiré, blocage posé) : la relire. */
  onStale?: () => void;
  /** La page rouverte après le rechargement ; la page d'Octave en cours par défaut. */
  landing?: string;
}

export const OctavePinSheet = memo(function OctavePinSheet({ profile, onCancel, onOpened, onStale, landing }: OctavePinSheetProps) {
  const { t } = useTranslation(["octaveShell", "profilePicker"]);
  // La liste d'un seul profil, stable tant que c'est le même (le choix s'y cherche).
  const profiles = useMemo(() => [profile], [profile]);
  const { flow, pad } = useOctavePick({ profiles, onOpened, onStale, landing });
  const { choose } = flow;
  useEffect(() => {
    choose(profile.userId);
  }, [choose, profile.userId]);

  const cancel = onCancel ?? noop;
  return (
    <Modal
      open
      onClose={cancel}
      dismissOnBackdrop={onCancel !== undefined}
      maxWidth={360}
      label={t("profilePicker:pin.title", { name: profile.name })}
    >
      <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-7" data-octave-pin-sheet>
        {pad ? (
          <ProfilePinPad pad={pad} onDigit={flow.digit} onErase={flow.erase} onBack={cancel} />
        ) : (
          <p aria-live="polite" className="min-h-[3rem] text-center text-sm text-content-secondary">
            {flow.notice ?? t("profilePicker:opening", { name: profile.name })}
          </p>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-full px-5 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {t("octaveShell:pinSheet.cancel")}
          </button>
        )}
      </div>
    </Modal>
  );
});

function noop(): void {}
