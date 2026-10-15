import { useCallback, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAutoUpdate } from "../hooks/useAutoUpdate";
import type { WhatsNewSelection } from "../whatsNew/selectFeatures";
import { useWhatsNewGate } from "../whatsNew/useWhatsNewGate";
import { useWhatsNewDevHook, whatsNewGateForced } from "../whatsNew/whatsNewDev";
import { WhatsNewScreen } from "../whatsNew/WhatsNewScreen";
import { isDesktopApp } from "../desktop/detect";
import { AvatarInvite } from "../profiles/avatarGallery/AvatarInvite";
import { FamilyPinStartup } from "../family/pinSuggest/FamilyPinStartup";
import { UpdateModal } from "./UpdateModal";

interface StartupOverlaysProps {
  authed: boolean;
}

/**
 * Les recouvrements de démarrage, un seul à la fois : l'écran de nouveautés
 * d'abord, la pop-up de mise à jour attend sa fermeture (`available` est un
 * état du hook, il persiste). Et l'inverse : une mise à jour en cours de
 * téléchargement ou d'installation n'est pas recouverte par des nouveautés.
 * Jamais sur /watch, jamais avant la session. En dernier, l'invitation unique
 * à choisir un avatar (`AvatarInvite`) : seulement quand les deux autres se
 * sont tus — la porte des nouveautés a TRANCHÉ et rien n'est à l'écran, aucune
 * mise à jour en vue — et, ouverte, elle suspend à son tour la pop-up de mise
 * à jour. Tout à la fin, « Action recommandée : posez votre code PIN »
 * (`FamilyPinStartup`) : après l'invitation aux avatars — qu'elle ait paru ou
 * renoncé —, jamais par-dessus un autre recouvrement ; ouverte, elle suspend
 * elle aussi la mise à jour et l'invitation.
 */
export function StartupOverlays({ authed }: StartupOverlaysProps) {
  const update = useAutoUpdate();
  const { pathname } = useLocation();
  const desktopLike = useMemo(whatsNewGateForced, []);
  const updateAtRest = update.phase === "idle" || update.phase === "available";
  const gate = useWhatsNewGate({
    enabled: authed && !pathname.startsWith("/watch") && updateAtRest,
    desktopLike,
  });

  // Sélection forcée par le crochet de développement : même écran, fermeture
  // sans écriture du drapeau.
  const [forced, setForced] = useState<WhatsNewSelection | null>(null);
  useWhatsNewDevHook(setForced);
  const clearForced = useCallback(() => setForced(null), []);

  const open = forced !== null || gate.open;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePending, setInvitePending] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const inviteBusy = !authed || pathname.startsWith("/watch") || !gate.decided || open || update.phase !== "idle";
  return (
    <>
      <WhatsNewScreen open={open} selection={forced ?? gate.selection} onClose={forced ? clearForced : gate.close} />
      <UpdateModal update={update} suspended={open || inviteOpen || pinOpen} />
      {authed && (
        <AvatarInvite
          desktop={desktopLike || isDesktopApp()}
          busy={inviteBusy || pinOpen}
          onOpenChange={setInviteOpen}
          onPendingChange={setInvitePending}
        />
      )}
      {authed && <FamilyPinStartup busy={inviteBusy || invitePending} onOpenChange={setPinOpen} />}
    </>
  );
}
