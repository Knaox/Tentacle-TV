import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { claimTvFocus, useTvFocusClaim } from "../../../hooks/useTvFocusClaim";
import { noteSkipFocusClaim, returnFocusToOsd } from "./osdFocusBus";

type PillButton = "skip" | "dismiss";
type FocusHandlers = { onFocus: () => void; onBlur: () => void };

interface SkipPillFocusArgs {
  skipRef: RefObject<unknown>;
  dismissRef: RefObject<unknown>;
  /** La pilule est montée — un passage à sauter, ou la suite à rejoindre. */
  shown: boolean;
  /** Elle PREND le focus : visible, pas revenue par l'habillage, aucun réglage. */
  grabs: boolean;
  /** « Masquer » est à l'écran (passage automatique non refusé). */
  refusable: boolean;
  overlayVisible: boolean;
  /** Une autre surface prend son focus elle-même : carte « à suivre », panneau. */
  focusOwnedElsewhere: boolean;
}

/**
 * Le focus de la pilule de saut (TVPlaybackOverlay) — qui le prend, qui le
 * garde, et à qui il revient.
 *
 * La RÉCLAMATION : au front montant de `grabs`, puis de nouveau quand
 * l'habillage s'éteint (ses boutons cessent d'être focusables, le focus se
 * perd). Son APPARITION est horodatée sur le bus : une restauration implicite
 * de l'habillage partie au même instant lui cède — c'est la sortie d'une
 * avance rapide, où l'habillage revient et la pilule reparaît un rendu plus
 * tard ; l'habillage (220 ms) défaisait la réclamation (120 ms).
 *
 * Le RELAIS : le bouton qui tenait le focus s'en va — passage fini, sauté,
 * refusé (« Masquer » part avec le refus). Un bouton démonté ne rend son focus
 * à personne, ni ne reçoit son flou : sur Android, plus rien n'était focalisé,
 * les touches n'atteignaient plus le JS, et la télécommande restait morte
 * jusqu'à l'extinction de l'habillage. L'état « focus dans l'îlot », resté
 * vrai, remontait en outre le guide de sortie à la prochaine apparition — qui
 * happait la remontée. Le focus va donc :
 *  - habillage à l'écran → à son dernier bouton (play/pause par défaut) ;
 *  - habillage éteint, pilule restée là → à la pilule ;
 *  - habillage éteint, plus rien → au fond (TVPlayerView le réclame).
 */
export function useSkipPillFocus({
  skipRef, dismissRef, shown, grabs, refusable, overlayVisible, focusOwnedElsewhere,
}: SkipPillFocusArgs): { islandFocused: boolean; handlers: Record<PillButton, FocusHandlers> } {
  // Le SECOND moment de la réclamation : l'habillage s'éteint. Rien
  // n'apparaît, donc rien ne monte — c'est le nonce qui réclame de nouveau.
  const [claim, setClaim] = useState(0);
  const wasOverlayVisible = useRef(overlayVisible);
  useEffect(() => {
    const closing = wasOverlayVisible.current && !overlayVisible;
    wasOverlayVisible.current = overlayVisible;
    if (closing && grabs) setClaim((n) => n + 1);
  }, [overlayVisible, grabs]);

  useTvFocusClaim(refusable ? dismissRef : skipRef, grabs, claim);

  // Horodatée quand la pilule APPARAÎT en prenant le focus — pas quand les
  // réglages se referment sur elle : ce focus-là revient au bouton qui les a
  // ouverts, par une restauration implicite qui ne doit donc pas céder.
  const wasShown = useRef(false);
  useEffect(() => {
    if (shown && grabs && !wasShown.current) noteSkipFocusClaim();
    wasShown.current = shown;
  }, [shown, grabs]);

  // Deux états plutôt qu'un seul : passer d'un bouton à l'autre émet un blur
  // et un focus dont l'ordre n'est pas garanti, et un drapeau unique
  // clignoterait. Le ref, lui, ne change qu'au focus et au flou DU MÊME bouton.
  const [skipFocused, setSkipFocused] = useState(false);
  const [dismissFocused, setDismissFocused] = useState(false);
  const holderRef = useRef<PillButton | null>(null);

  // Le RELAIS (cf. en-tête) : pilule partie, ou « Masquer » parti avec le refus.
  useEffect(() => {
    const holder = holderRef.current;
    if (!(holder && !shown) && !(holder === "dismiss" && !refusable)) return;
    holderRef.current = null;
    setSkipFocused(false);
    setDismissFocused(false);
    if (focusOwnedElsewhere) return;
    if (overlayVisible) returnFocusToOsd();
    else if (shown) return claimTvFocus(skipRef.current);
  }, [shown, refusable, overlayVisible, focusOwnedElsewhere, skipRef]);

  // Stables : `Focusable` est mémoïsé.
  const handlers = useMemo(() => {
    const bind = (key: PillButton, set: (v: boolean) => void): FocusHandlers => ({
      onFocus: () => { holderRef.current = key; set(true); },
      onBlur: () => {
        if (holderRef.current === key) holderRef.current = null;
        set(false);
      },
    });
    return { skip: bind("skip", setSkipFocused), dismiss: bind("dismiss", setDismissFocused) };
  }, []);

  return { islandFocused: skipFocused || dismissFocused, handlers };
}
