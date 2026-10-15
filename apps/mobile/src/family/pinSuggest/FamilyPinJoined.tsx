import { useEffect, useState } from "react";
import { useFamilyOverview } from "@tentacle-tv/api-client";
import { whenNoModal } from "@/components/ui/modalGate";
import { FamilyPinSuggest } from "./FamilyPinSuggest";
import { useFamilyPinReminder } from "./useFamilyPinReminder";

/** La Famille relue après l'acceptation n'est jamais arrivée : on renonce, l'affiche reprend sa place. */
const GIVE_UP_MS = 15_000;

/**
 * Juste après « Accepter » : « Bienvenue dans la famille de … », si le profil
 * n'a pas de code PIN. On attend la Famille RELUE (l'acceptation l'invalide)
 * et que l'affiche se soit retirée (`whenNoModal`) ; relue avec un code déjà
 * posé, on se retire sans rien montrer.
 *
 * « Configurer plus tard » ferme seulement : le rappel du compte reste — la
 * carte de l'écran Famille, et la fenêtre du prochain démarrage.
 */
export function FamilyPinJoined({ owner, onClose }: { owner: string; onClose: () => void }) {
  const { card } = useFamilyPinReminder();
  const overview = useFamilyOverview();
  const joined = overview.data?.family != null;
  const [shown, setShown] = useState(false);
  const [asked, setAsked] = useState(false);

  // Relue avec une famille : un code à suggérer → dès qu'aucune modale n'est
  // à l'écran ; déjà protégé → on se retire.
  useEffect(() => {
    if (!joined || asked) return;
    if (!card) {
      onClose();
      return;
    }
    setAsked(true);
    whenNoModal(() => setShown(true));
  }, [joined, card, asked, onClose]);

  useEffect(() => {
    if (joined) return;
    const timer = setTimeout(onClose, GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [joined, onClose]);

  if (!shown) return null;
  return <FamilyPinSuggest variant="joined" owner={owner} onLater={onClose} onClose={onClose} />;
}
