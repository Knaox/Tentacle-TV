/**
 * La suite de l'espace `errors` — les causes ajoutées pour le mobile et la
 * tablette (20/10, `problems/problemCatalogMore.ts`). Fusionnée dans
 * `errors.ts` : mêmes règles (mots de spectateur, jamais « téléchargement »,
 * jamais un reproche ni une excuse vide).
 */
export default {
  // QUOI : les nouveaux contextes.
  titleOfflineTransfer: "Ce titre n'a pas pu être gardé hors ligne",
  titleNotifications: "Les notifications ne peuvent pas arriver",
  titleCast: "La diffusion sur la TV s'est arrêtée",
  titlePictureInPicture: "L'image dans l'image n'est pas disponible",
  titleProfile: "Votre profil s'est fermé",
  titleScreen: "Cet écran n'a pas pu s'afficher",
  // POURQUOI — la connexion au compte.
  reasonWrongCredentials: "Le nom d'utilisateur ou le mot de passe ne correspond pas.",
  hintWrongCredentials: "Vérifiez les majuscules, puis réessayez.",
  reasonAccountDisabled: "Ce compte a été désactivé par l'administrateur du serveur.",
  reasonAccountLockedOut: "Ce compte est bloqué après trop d'essais.",
  hintAccountAdmin: "L'administrateur du serveur peut le réactiver.",
  reasonAccountOutsideSchedule: "Ce compte ne peut pas se connecter à cette heure-ci.",
  hintAccountOutsideSchedule: "L'administrateur a fixé ses heures d'accès.",
  reasonAccountMaxSessions: "Ce compte est déjà connecté sur le nombre maximal d'appareils.",
  hintAccountMaxSessions: "Déconnectez un autre appareil, puis réessayez.",
  reasonTooManyAttempts: "Trop d'essais d'affilée.",
  hintTooManyAttempts: "Patientez une minute, puis réessayez.",
  reasonDatabaseMigrating: "Le serveur Tentacle met à jour sa base de données.",
  hintDatabaseMigrating: "Cela prend quelques minutes ; l'app reprendra d'elle-même.",
  // POURQUOI — Famille et droits.
  reasonProfileSessionExpired: "La session de ce profil a pris fin sur cet appareil.",
  hintProfileSessionExpired: "Choisissez de nouveau votre profil pour continuer.",
  reasonParentalBlocked: "Ce titre n'est pas autorisé pour ce profil.",
  hintParentalBlocked: "Le contrôle parental de la famille le masque. Le propriétaire de la famille peut changer cette règle.",
  // POURQUOI — Watch Together.
  reasonWtJoinFailed: "Impossible de rejoindre la séance.",
  hintWtJoinFailed: "La connexion au serveur a peut-être été coupée. Réessayez dans un instant.",
  reasonWtMemberLeft: "{{name}} a quitté la séance.",
  reasonWtMemberDisconnected: "{{name}} a perdu sa connexion.",
  hintWtMemberDisconnected: "La séance l'attend un instant.",
  reasonWtRoomClosed: "La séance est terminée.",
  hintWtRoomClosed: "Vous pouvez continuer à regarder seul.",
  reasonWtRemoved: "Vous avez été retiré de la séance.",
  reasonWtInviteExpired: "Cette invitation n'est plus valable.",
  hintWtInviteExpired: "La séance est peut-être terminée. Demandez une nouvelle invitation.",
  reasonWtAccessRevoked: "Ce compte n'a plus accès à Watch Together.",
  reasonWtAlreadyInGroup: "Vous êtes déjà dans une autre séance.",
  hintWtAlreadyInGroup: "Quittez-la d'abord pour rejoindre celle-ci.",
  reasonWtHostOnly: "Seul l'hôte de la séance peut faire cela.",
  reasonWtTitleUnavailable: "Ce titre n'est pas disponible pour tout le monde dans la séance.",
  hintWtTitleUnavailable: "Choisissez-en un que chaque membre peut regarder.",
  reasonWtDesync: "Cet appareil n'arrive plus à suivre la séance.",
  hintWtDesync: "Rejoignez-la de nouveau : la lecture se recalera sur les autres.",
  // POURQUOI — hors ligne.
  reasonTransferFailed: "Le transfert vers cet appareil s'est interrompu.",
  hintTransferFailed: "Réessayez : il reprendra là où il s'est arrêté.",
  reasonStorageFull: "Il n'y a plus assez d'espace sur cet appareil.",
  hintStorageFull: "Retirez des titres gardés hors ligne, ou libérez de l'espace, puis réessayez.",
  reasonWifiRequired: "Le transfert attend le Wi-Fi.",
  hintWifiRequired: "Vos réglages le réservent au Wi-Fi : il repartira seul dès que vous serez connecté.",
  reasonTransferSourceGone: "Ce titre n'est plus disponible sur le serveur.",
  hintTransferSourceGone: "Il a peut-être été retiré de la bibliothèque.",
  reasonOfflineRightsRevoked: "Ce titre gardé hors ligne n'est plus autorisé pour ce compte.",
  hintOfflineRightsRevoked: "Il sera retiré de cet appareil à la prochaine connexion au serveur.",
  // POURQUOI — notifications.
  reasonPushDenied: "Les notifications de Tentacle sont coupées sur cet appareil.",
  hintPushDenied: "Autorisez-les dans les réglages de l'appareil pour être prévenu.",
  reasonPushUnavailable: "Cet appareil n'a pas pu s'inscrire aux notifications.",
  hintPushUnavailable: "Le service de notifications ne répond pas pour le moment. Réessayez plus tard.",
  // POURQUOI — diffusion, image dans l'image.
  reasonCastFailed: "La TV n'a pas pu lancer ce titre.",
  hintCastFailed: "Vérifiez que la TV et cet appareil sont sur le même réseau.",
  reasonCastLost: "La connexion avec la TV a été perdue.",
  hintCastLost: "Reprenez sur cet appareil, ou relancez la diffusion.",
  reasonCastFormatUnsupported: "La TV ne sait pas lire ce format.",
  hintCastFormatUnsupported: "Une qualité réduite le fait convertir dans un format plus simple.",
  reasonPipUnavailable: "L'image dans l'image est désactivée pour Tentacle sur cet appareil.",
  hintPipUnavailable: "Vous pouvez l'autoriser dans les réglages de l'appareil.",
  // POURQUOI — un écran qui plante.
  reasonRenderCrash: "Une erreur inattendue a interrompu l'affichage.",
  hintRenderCrash: "Réessayez. Le reste de l'app continue de fonctionner.",
  // QUOI FAIRE.
  actionOpenSettings: "Ouvrir les réglages",
  actionManageOffline: "Gérer les titres hors ligne",
  actionRejoin: "Rejoindre de nouveau",
  actionSwitchProfile: "Changer de profil",
  actionPlayHere: "Lire sur cet appareil",
  actionDismiss: "OK",
  // Le code du support, en petit sous le message.
  supportCode: "Code : {{code}}",
  // Un message reçu d'un autre appareil, d'une autre version : jamais un code seul.
  genericTitle: "Quelque chose n'a pas fonctionné",
} as const;
