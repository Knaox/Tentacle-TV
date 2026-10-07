/**
 * L'accès à distance, en clair : privé ou public (deux petits schémas),
 * l'adresse de ce serveur sur le réseau, l'interrupteur « Accès depuis
 * l'extérieur », l'adresse publique détectée, les deux ports à ouvrir, la
 * lecture directe hors de la maison (facultative) et la sécurité. Fondu dans
 * l'espace `remoteAccess` (`remoteAccess.ts`). Espaces insécables ( )
 * devant « ? », « : » et « ! ».
 */
export default {
  modesTitle: "Qui peut joindre Tentacle ?",
  modePrivateTitle: "Privé",
  modePrivateBody: "Seuls les appareils de la maison y accèdent : votre téléphone, votre TV, votre ordinateur, sur le même réseau.",
  modePublicTitle: "Public",
  modePublicBody: "Vos proches y accèdent aussi de chez eux, par votre adresse {{ip}}.",
  modePublicBodyUnknown: "Vos proches y accèdent aussi de chez eux, par l'adresse publique de votre box.",
  modeCurrent: "Réglage actuel",
  diagramHome: "Maison",
  diagramBox: "Box",
  diagramServer: "Serveur",
  diagramInternet: "Internet",
  diagramFriend: "Un proche",
  diagramPrivateAlt: "Schéma : les appareils de la maison joignent le serveur à travers la box ; rien n'entre depuis Internet.",
  diagramPublicAlt: "Schéma : un proche, sur Internet, joint votre box par {{ip}} ; la box transmet au serveur.",

  lanExample: "Celle que vous tapez à la maison pour ouvrir Tentacle, par exemple {{example}}. Proposée d'après l'adresse de cette page : modifiez-la si elle ne convient pas.",
  lanUsedFor: "Elle sert à vos appareils de la maison, et à la box pour savoir où envoyer les visites d'Internet.",

  exposureOff: "Coupé : rien n'est publié. Tentacle et Jellyfin ne répondent qu'à la maison, par leur adresse privée. Tout le reste marche comme d'habitude.",
  exposureOn: "Allumé : l'adresse publique réglée plus bas est donnée à vos applications. Il faut aussi ouvrir les ports sur la box.",
  exposureSaveFailed: "Le réglage n'a pas été enregistré. Réessayez.",

  publicIpTitle: "Votre adresse publique",
  publicIpDetected: "Détectée automatiquement.",
  publicIpFromCheck: "Vue par le dernier test d'ouverture.",
  publicIpLoading: "Détection…",
  publicIpUnavailable: "Impossible de la détecter pour l'instant. Votre box l'affiche dans son interface (« adresse IP WAN » ou « IPv4 publique »).",
  publicIpDisabled: "La détection est coupée sur ce serveur (REMOTE_CHECK_URL=off).",
  reach_open: "Joignable depuis Internet : le test d'ouverture a réussi.",
  reach_closed: "Pas encore joignable depuis Internet : les ports ne sont pas ouverts, ou la box ne les transmet pas à ce serveur.",
  reach_unknown: "Pas encore vérifié : lancez le test plus bas, une fois les ports ouverts.",
  reach_no_service: "Le test d'ouverture automatique n'est pas encore en ligne. Pour vérifier vous-même : sur un téléphone en 4G ou 5G (Wi-Fi coupé), ouvrez {{url}}.",
  reach_no_service_generic: "Le test d'ouverture automatique n'est pas encore en ligne. Pour vérifier vous-même : ouvrez votre adresse publique sur un téléphone en 4G ou 5G (Wi-Fi coupé).",
  reach_disabled: "Le test d'ouverture est coupé sur ce serveur.",

  proxyWhat: "Un mandataire (reverse proxy) est un petit programme qui reçoit les visites venues d'Internet et les transmet à Tentacle, en ajoutant le HTTPS — le cadenas du navigateur.",
  proxyNotIncluded: "Caddy, Traefik et Nginx ne sont NI inclus NI installés par Tentacle : n'en choisissez un que si vous l'avez DÉJÀ. Sinon, gardez « Sans mandataire ».",
  defaultChoice: "Par défaut",

  portsIntro: "Sur votre box, créez une redirection par ligne : les visites d'Internet sur ce port sont envoyées à ce serveur.",
  portOptional: "Seulement si vous allumez la lecture directe hors de la maison, plus bas.",

  publicLinkTitle: "Adresse publique de Tentacle",
  publicLinkSuggested: "Celle que vos proches et vos applications utiliseront hors de la maison :",
  publicLinkUse: "Utiliser cette adresse",
  publicLinkNoIp: "Une fois l'adresse publique connue, elle sera proposée ici.",
  publicLinkDynamic: "Si votre box change d'adresse publique (adresse dynamique), il faudra la mettre à jour : un nom de domaine l'évite.",

  directTitle: "Lecture directe hors de la maison (facultatif)",
  directDescription: "Facultatif\u00a0: à la maison, vos appareils lisent déjà en direct\u00a0; hors de la maison, il faut ouvrir Jellyfin sur Internet.",
  directSwitch: "Lecture directe depuis l'extérieur",
  directOff: "Coupée : hors de la maison, les vidéos passent par Tentacle. Rien de plus à ouvrir.",
  directOn: "Allumée : vos applications lisent directement chez Jellyfin, par son adresse publique. Souvent plus fluide, mais Jellyfin est alors joignable depuis Internet.",
  directUrl: "Adresse publique de Jellyfin",
  directUrlHint: "Par exemple {{example}}.",
  directUrlMissing: "Donnez l'adresse publique de Jellyfin, ou coupez la lecture directe depuis l'extérieur.",
  directHome: "À la maison, vos appareils lisent déjà en direct par {{url}}.",
  directHomeOff: "La lecture directe à la maison est coupée (Administration › Services).",
  directSaved: "Lecture directe enregistrée.",

  securityTitle: "Sécurité",
  security_default: "Rien n'est exposé par défaut : tant que l'accès depuis l'extérieur est coupé, rien n'est publié.",
  security_secrets: "Aucun mot de passe ni jeton n'apparaît dans une adresse.",
  security_https: "HTTPS conseillé : sans mandataire, la connexion depuis l'extérieur n'est pas chiffrée.",
};
