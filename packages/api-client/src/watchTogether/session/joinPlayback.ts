import type { WtRoomStateDto } from "@tentacle-tv/shared";

/**
 * « Rejoindre » la lecture du groupe, pour un membre déjà dans le groupe
 * (pilule, bande de l'accueil, feuille). Face à un serveur qui déclare
 * `watchTogether.arrival`, la salle se gèle AU CLIC et attend cet appareil
 * (`POST /group/arrive`) : son état gelé est posé, le lecteur s'ouvre à la
 * position de la pause. Sans la capacité — ou si l'appel échoue —, le
 * lecteur s'ouvre comme avant : la salle se gèlera à son ouverture.
 */
export async function joinGroupPlayback(opts: {
  /** Le serveur déclare `watchTogether.arrival`. */
  arrival: boolean;
  itemId: string | null | undefined;
  arrive: () => Promise<WtRoomStateDto>;
  onFrozen: (room: WtRoomStateDto) => void;
  navigate: (itemId: string) => void;
}): Promise<void> {
  const { itemId } = opts;
  if (!itemId) return;
  if (opts.arrival) await opts.arrive().then(opts.onFrozen, () => undefined);
  opts.navigate(itemId);
}
