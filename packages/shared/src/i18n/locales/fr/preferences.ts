export default {
  changePasswordTitle: "Mot de passe",
  changePasswordDescription: "Modifiez le mot de passe de votre compte Jellyfin. Le mot de passe actuel est requis.",
  currentPassword: "Mot de passe actuel",
  newPassword: "Nouveau mot de passe",
  confirmNewPassword: "Confirmer le nouveau mot de passe",
  passwordTooShort: "Le nouveau mot de passe doit contenir au moins 6 caractères",
  passwordMismatch: "Les mots de passe ne correspondent pas",
  passwordChanged: "Mot de passe modifié avec succès",
  passwordChanging: "Modification...",
  passwordChangeError: "Échec du changement de mot de passe",
  showPassword: "Afficher le mot de passe",
  hidePassword: "Masquer le mot de passe",
  title: "Préférences de langues",
  subtitle: "Configurez les pistes audio et sous-titres par défaut pour chaque bibliothèque.",
  interfaceLanguage: "Langue de l'interface",
  offlineSavedLocally: "Hors ligne : les modifications sont enregistrées localement et seront synchronisées au retour en ligne.",
  offlineNoCacheHint: "Bibliothèques inconnues hors ligne — repasse en ligne une fois pour les mémoriser.",
  appearance: "Apparence",
  appearanceDescription: "Choisissez le thème de l'application.",
  theme: "Thème",
  themeLight: "Clair",
  themeDark: "Sombre",
  themeAuto: "Auto",
  themeAutoHint: "Suit le réglage du système",
  effects: "Effets",
  liquidGlassTitle: "Liquid Glass",
  // Formulation volontairement neutre : le mobile s'appuie sur le rendu natif
  // d'iOS 26, le web sur une réfraction SVG. Mentionner iOS ici serait faux sur
  // desktop, où cette même clé est affichée.
  liquidGlassDescription: "Ajoute une réfraction aux surfaces translucides. Désactivé, l'application revient à l'effet verre classique.",
  liquidGlassUnavailable: "Non disponible sur ce moteur de rendu — l'effet verre classique est utilisé.",

  // ── Sections de la coquille de réglages ──
  // Titre ombrelle de l'écran (atterrissage mobile). `title` reste le titre
  // historique de la seule page Lecture (« Préférences de langues »).
  settingsTitle: "Réglages",
  sectionAccount: "Compte",
  sectionSecurity: "Sécurité",
  sectionAppearance: "Apparence",
  sectionPlayback: "Lecture",
  sectionDownloads: "Téléchargements",
  sectionData: "Données",
  sectionHelp: "Aide",
  sectionDanger: "Zone sensible",
  back: "Retour",

  // ── Sécurité (regroupe ce qui était dispersé sur 4 écrans) ──
  securityDescription: "Mot de passe, appareils jumelés et connexion au serveur.",
  securityPassword: "Mot de passe",
  securityPasswordHint: "Modifier le mot de passe du compte Jellyfin",
  securityDevices: "Mes appareils jumelés",
  securityDevicesHint: "Téléviseurs et applications autorisés sur ce compte",
  securityServer: "Serveur",
  securityServerHint: "Changer de serveur Tentacle",
  audio: "Audio",
  subtitles: "Sous-titres",
  subtitleMode: "Mode sous-titres",
  default: "Par défaut",
  none: "Aucun",
  reset: "Réinitialiser",
  modeDisabled: "Désactivés",
  modeAlwaysOn: "Toujours affichés",
  modeForcedOnly: "Forcés uniquement",
  modeSignsSongs: "Signs & Songs",
  langFr: "Français",
  langFrVff: "Français VFF",
  langFrVfq: "Français VFQ",
  langEn: "English",
  langJa: "Japonais",
  langDe: "Allemand",
  langEs: "Espagnol",
  langIt: "Italien",
  langPt: "Portugais",
  langRu: "Russe",
  langKo: "Coréen",
  langZh: "Chinois",
  langAr: "Arabe",
  langPl: "Polonais",
  langNl: "Néerlandais",
  langCs: "Tchèque",
  langHi: "Hindi",
  langTh: "Thaï",
  langSv: "Suédois",
  langNo: "Norvégien",
  langFi: "Finnois",
  langTr: "Turc",
  langHu: "Hongrois",
  langRo: "Roumain",
  langEl: "Grec",
  langDa: "Danois",
  langHe: "Hébreu",
  langVi: "Vietnamien",
  langId: "Indonésien",
  langMs: "Malais",
  langUk: "Ukrainien",
  langBg: "Bulgare",
  langHr: "Croate",
  langSr: "Serbe",
  langCa: "Catalan",
  langTa: "Tamoul",
  langTe: "Télougou",
  langFa: "Persan",

  // Bascule HDR de l'écran (bureau Windows avec lecteur natif)
  hdrAutoTitle: "Basculer l'écran en HDR pendant la lecture",
  hdrAutoHint:
    "Un film HDR s'affiche alors avec toutes ses couleurs. Le changement de mode noircit l'écran une seconde ou deux, et l'état d'origine est rétabli à la fin de la lecture. Désactivé, le film est adapté à votre écran sans changer son mode.",
  // Choix de session graphique (bureau Linux avec lecteur natif)
  linuxSessionTitle: "Affichage vidéo (Wayland ou X11)",
  linuxSessionHint:
    "Wayland permet le HDR. Sur KDE Plasma, la lecture suit votre fenêtre — fenêtrée ou plein écran, comme partout ailleurs. Sur les autres bureaux Wayland, la lecture native passe obligatoirement en plein écran (le système n'y laisse pas une application placer ses fenêtres) ; X11 reste alors le recours fenêtré, sans HDR. « Auto » suit la session du bureau. Le changement prend effet au prochain lancement.",
  linuxSessionAuto: "Auto — suivre le bureau",
  linuxSessionWayland: "Wayland — support HDR intégré",
  linuxSessionX11: "X11 — sans HDR",
  linuxSessionCurrent: "Montage actuel : {{montage}}",
  linuxSessionRestart: "Relancer maintenant",
  // Toast unique, à la première lecture native sous Wayland — renvoie ici.
  linuxSessionFullscreenToast:
    "Lecture en plein écran : sous Wayland, c'est le prix du HDR. Pour regarder en fenêtré, un réglage X11 existe dans les Préférences.",

  // Passages d'un épisode et fin d'épisode. Ces réglages suivent le COMPTE et
  // non l'appareil : celui posé sur le portable vaut devant le téléviseur.
  //
  // Le MODE est en tête parce que c'est la seule question que la plupart des
  // gens se posent ; le détail vit sous un repli.
  playbackModeTitle: "Sauts et enchaînement",
  playbackModeLabel: "Ce que fait le lecteur",
  playbackModeDefault: "Par défaut",
  playbackModeDefaultHint:
    "Le réglage livré : le générique de début et l'aperçu du suivant se passent seuls après cinq secondes, le résumé et le générique de fin vous sont proposés, et l'épisode suivant s'enchaîne.",
  playbackModeManual: "Me proposer",
  playbackModeAutomatic: "Faire tout seul",
  playbackModeCustom: "Personnalisé",
  playbackModeManualHint:
    "Le lecteur affiche un bouton et attend votre geste. Il ne saute rien et n'enchaîne pas les épisodes.",
  playbackModeAutomaticHint:
    "Le lecteur passe les génériques et les résumés après un court délai, et enchaîne l'épisode suivant. Un film ne se ferme jamais tout seul.",
  playbackModeCustomHint:
    "Vos réglages ne correspondent à aucun des deux modes. Le détail est ci-dessous ; choisir un mode le remplacera.",
  playbackAdvancedToggle: "Réglages avancés",
  playbackAdvancedOnDesktop:
    "Le réglage fin — quel passage, quel délai, quel déclencheur — se fait depuis Tentacle sur ordinateur. Il suit votre compte et s'applique ici.",
  playbackSegmentsTitle: "Passages d'un épisode",
  playbackSegmentsSummary: "Générique de début, résumé, générique de fin, aperçu.",
  upNextSummary: "La fiche « à suivre », le compte à rebours, et quand les proposer.",
  playbackSegmentsHint:
    "Quand le serveur signale un passage — générique, résumé, aperçu — le lecteur peut proposer de le passer, le passer tout seul, ou ne rien faire. Sans signalement, rien ne s'affiche : ces réglages ne devinent jamais.",
  playbackSettingsAccount: "Ces réglages suivent votre compte, sur tous vos appareils.",
  // Deux boutons plutôt qu'un interrupteur sur le téléviseur : à la
  // télécommande, un pouce qui coulisse ne veut rien dire.
  reglageActive: "Activé",
  reglageDesactive: "Désactivé",

  segmentIntroTitle: "Générique de début",
  segmentIntroHint: "L'ouverture d'une série, celle qui revient à chaque épisode.",
  segmentOutroTitle: "Générique de fin",
  segmentOutroHint:
    "Quand un épisode suivant existe, c'est la fiche « à suivre » qui occupe le générique. Le bouton n'apparaît que s'il mène ailleurs : une scène après le générique, ou la fin d'un film.",
  segmentRecapTitle: "Résumé de l'épisode précédent",
  segmentRecapHint: "Le « précédemment », au début d'un épisode.",
  segmentPreviewTitle: "Aperçu du prochain épisode",
  segmentPreviewHint: "Les images du prochain épisode, montées après le générique de fin.",
  segmentActionLabel: "Ce que fait le lecteur",
  segmentActionButton: "Proposer un bouton",
  segmentActionAuto: "Passer tout seul",
  segmentActionOff: "Ne rien faire",
  segmentCountdownTitle: "Montrer le décompte",
  segmentCountdownHint:
    "Le bouton se remplit pendant le délai. La croix, elle, est toujours là : elle arrête le décompte et retire le bouton de l'image jusqu'à la fin de la lecture — il revient dès que les contrôles s'affichent.",
  segmentDelayLabel: "Délai avant le saut",
  segmentDelayHint: "Le temps laissé pour refuser avant que le lecteur ne passe.",
  segmentDelayValue: "{{seconds}} s",
  segmentDelayImmediate: "Immédiat",

  // Fin d'épisode — TROIS réglages strictement indépendants : montrer la
  // fiche, décompter, lancer. Couper le décompte ne masque plus la fiche.
  upNextTitle: "À la fin d'un épisode",
  upNextCardTitle: "Proposer l'épisode suivant",
  upNextCardHint:
    "Pendant le générique de fin, une petite fiche propose l'épisode suivant dans un coin de l'image. Désactivée, la fin de l'épisode reste nue. L'écran de fin, lui, continue de s'afficher au tout dernier instant.",
  upNextCountdownTitle: "Montrer un compte à rebours",
  upNextCountdownHint:
    "La fiche et l'écran de fin annoncent le temps qu'il reste. Sans lui, la fiche est une simple proposition, qui attend votre geste.",
  upNextAutoPlayTitle: "Enchaîner tout seul",
  upNextAutoPlayHint:
    "À la fin du compte à rebours, l'épisode suivant démarre. Ce réglage demande donc le compte à rebours ci-dessus : sans lui, rien ne se déclenche.",
  upNextTriggerLabel: "Quand proposer la suite",
  upNextTriggerOutroStart: "Au début du générique de fin",
  upNextTriggerBeforeEnd: "Peu avant la fin",
  upNextTriggerHint:
    "« Au début du générique » suit ce que le serveur a détecté, et ne se sert du seuil ci-dessous que lorsqu'il n'a rien détecté — les deux ne peuvent donc jamais se contredire. « Peu avant la fin » impose votre seuil, même quand un générique est connu.",
  // Le repli « avant la fin » : facultatif, global, et par bibliothèque.
  beforeEndEnabledTitle: "Proposer la suite même sans générique détecté",
  beforeEndEnabledHint:
    "Quand le serveur ne signale aucun générique de fin, le lecteur ne sait pas quand l'épisode se termine. Ce réglage lui donne un repère. Éteint, la fin de ces épisodes reste nue — mieux vaut rien qu'une fiche posée au hasard.",
  beforeEndDefaultTitle: "Seuil par défaut",
  beforeEndDefaultHint:
    "Ce qui s'applique aux bibliothèques qu'aucune règle ne vise. En proportion, il vaut pour tous les formats sans réglage : 98 % font vingt-huit secondes sur un animé et quarante sur une série d'une heure.",
  beforeEndModeLabel: "Compter en",
  beforeEndModePercent: "Pourcentage",
  beforeEndModeSeconds: "Secondes",
  beforeEndPercentLabel: "Part du média déjà vue",
  beforeEndPercentValue: "{{value}} %",
  beforeEndSecondsLabel: "Temps restant",
  beforeEndSecondsValue: "{{value}} s",
  beforeEndAddRule: "Ajouter une règle",
  beforeEndRuleTitle: "Règle {{index}}",
  beforeEndRemoveRule: "Retirer",

  upNextNeedsCard: "Sans la fiche ci-dessus, ce réglage n'a rien à décompter.",
  upNextNeedsCountdown: "Sans le compte à rebours ci-dessus, rien ne se déclenche.",
  upNextBeforeEndLabel: "Combien de temps avant la fin",
  upNextBeforeEndValue: "{{seconds}} s",
  upNextBeforeEndHint:
    "Sert aussi quand le générique de fin n'est pas signalé : la fiche paraît alors ce temps-là avant la fin.",

  // Décodage matériel — réglage d'APPAREIL, visible seulement sur le bureau.
  hwDecodeTitle: "Décodage matériel",
  hwDecodeHint:
    "Qui décode la vidéo : la carte graphique, ou le processeur. Si certaines vidéos apparaissent en gros carrés colorés alors qu'elles sont nettes ailleurs, c'est ici que ça se règle.",
  hwDecodeAuto: "Automatique",
  hwDecodeCopy: "Copie mémoire",
  hwDecodeOff: "Logiciel",
  hwDecodeAutoHint: "Le lecteur choisit le décodeur le mieux adapté à votre carte graphique.",
  hwDecodeCopyHint:
    "La carte décode, mais l'image repasse par la mémoire avant l'affichage. Un peu plus coûteux, et cela corrige les images cassées dues à un pilote capricieux.",
  hwDecodeOffHint:
    "Le processeur décode seul. C'est le plus sûr, et le plus gourmand — à réserver au cas où les deux autres échouent.",

  hdrAutoUnsupported:
    "Aucun écran compatible HDR n'a été détecté. Les films HDR restent adaptés à votre écran, sans perte de compatibilité.",
} as const;
