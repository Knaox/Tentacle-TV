/**
 * Dernière piste DEMANDÉE à mpv pour le média courant.
 *
 * # À quoi ça sert
 *
 * mpv jette tout son cache de demuxer à chaque changement de piste audio ou de
 * sous-titres — défaut amont connu et jamais corrigé (mpv#8422 : « la quantité
 * de cache affichée se réinitialise à zéro et se reconstruit »). Une commande
 * de piste redondante ne coûte donc pas rien : elle coûte la réserve entière,
 * et le rechargement qui suit.
 *
 * Les effets de préférence tirent deux fois — une fois au démarrage de l'image,
 * une fois quand la track-list de mpv arrive 300 ms plus tard — et il faut que
 * le second passage sache reconnaître ce qui a déjà été demandé.
 *
 * # Pourquoi pas l'état observé
 *
 * `state.audioTrack`/`state.subtitleTrack` dépendent d'un aller-retour IPC qui
 * peut manquer : `sid = no` remonte en `MPV_FORMAT_NONE`, donc `null`, et le
 * handler conserve alors la valeur précédente. L'état observé peut mentir.
 * « Ai-je déjà demandé ça ? » ne dépend de personne.
 *
 * Redemander la même chose est par définition un no-op ; ne pas la redemander
 * ne peut donc pas avaler une correction légitime, qui calcule par construction
 * un id différent.
 *
 * # Pourquoi un état de module
 *
 * Il n'existe qu'une instance mpv par processus — même raison que `api` et
 * `pendingDestroy` dans `mpvRuntime`. Cela évite de câbler des refs à travers
 * quatre hooks pour une information qui n'a qu'un seul propriétaire.
 */

/** `null` = inconnu, et jamais égal à un id candidat. `0` est une vraie valeur (« no »). */
let aidDemande: number | null = null;
let sidDemande: number | null = null;

export function noterAid(id: number): void { aidDemande = id; }
export function noterSid(id: number): void { sidDemande = id; }

export function aidDemandeCourant(): number | null { return aidDemande; }
export function sidDemandeCourant(): number | null { return sidDemande; }

/** Nouveau média : les intentions du précédent n'ont plus cours. */
export function oublierPistesDemandees(): void {
  aidDemande = null;
  sidDemande = null;
}
