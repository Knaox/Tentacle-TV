import { useEffect, useState } from "react";
import { useFamilyOverview } from "@tentacle-tv/api-client";
import { FamilyPinSuggestDialog } from "./FamilyPinSuggestDialog";
import { useFamilyPinReminder } from "./useFamilyPinReminder";

/** La Famille relue après l'acceptation n'est jamais arrivée : on renonce, l'affiche reprend sa place. */
const GIVE_UP_MS = 15_000;

/**
 * Juste après « Accepter » : « Bienvenue dans la famille de … », si le profil
 * n'a pas de code PIN. On attend la Famille RELUE (l'acceptation l'invalide) :
 * tant qu'elle ne montre pas la famille rejointe, rien ne paraît ; relue avec
 * un code déjà posé, on se retire sans rien montrer.
 *
 * « Configurer plus tard » ferme seulement : le rappel du compte reste — la
 * carte de Réglages › Famille, et la fenêtre du prochain démarrage.
 */
export function FamilyPinJoined({ owner, onClose }: { owner: string; onClose: () => void }) {
  const { card } = useFamilyPinReminder();
  const overview = useFamilyOverview();
  const joined = overview.data?.family != null;
  // Une fois montrée, la fenêtre reste — même quand le code posé éteint la règle.
  const [shown, setShown] = useState(false);
  if (card && !shown) setShown(true);

  // Relue : déjà protégé (ou plus rien à proposer) → on se retire.
  useEffect(() => {
    if (joined && !card && !shown) onClose();
  }, [joined, card, shown, onClose]);

  useEffect(() => {
    if (joined) return;
    const timer = setTimeout(onClose, GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [joined, onClose]);

  if (!shown) return null;
  return <FamilyPinSuggestDialog variant="joined" owner={owner} onLater={onClose} onClose={onClose} />;
}
