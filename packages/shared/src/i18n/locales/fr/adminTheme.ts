export default {
  title: "Thème et apparence",
  description:
    "Personnalise l'apparence de Tentacle TV. Les overrides de tokens s'appliquent aux 4 plateformes (web, desktop, mobile, TV). Le CSS personnalisé ne s'applique qu'au web et au desktop.",
  adminCardTitle: "Thème",
  adminCardDescription: "Surcharge des couleurs et injection de CSS personnalisé",
  adminCardButton: "Gérer le thème",
  currentTheme: "Thème actuel",
  defaultName: "Tentacle par défaut",
  nameSectionTitle: "Nom du thème",
  nameLabel: "Nom",
  nameSave: "Renommer",
  nameSaved: "Thème renommé",
  brandSectionTitle: "Couleur de marque",
  brandSectionHelp:
    "Utilisée pour les boutons, l'anneau de focus, les accents et les badges. S'applique au web, desktop, mobile et TV.",
  accentSectionTitle: "Couleur d'accent",
  accentSectionHelp:
    "Couleur secondaire utilisée dans les dégradés de marque (logo, hero, badges). Se combine avec la couleur principale ci-dessus pour former le dégradé signature.",
  brandColorLabel: "Couleur (hex)",
  brandColorApply: "Appliquer",
  brandColorReset: "Revenir à la valeur par défaut",
  brandColorReverted: "Couleur de marque restaurée",
  brandColorInvalid: "Couleur hex invalide (format #RRGGBB)",
  customCssTitle: "CSS personnalisé (web / desktop uniquement)",
  customCssHelp:
    "Injecte ton propre CSS pour modifier en profondeur l'interface. Chargé en dernier donc il prend le dessus sur les styles intégrés. Les apps mobile et TV n'utilisent pas le CSS — elles ne respectent que les overrides de tokens ci-dessus.",
  customCssRiskTitle: "Note de sécurité",
  customCssRisk:
    "Le CSS personnalisé peut charger des ressources externes via url() ou @import. N'utilise que du CSS provenant de sources de confiance.",
  sourceLabel: "Source",
  sourceInline: "Contenu inline",
  sourceUrl: "URL distante",
  inlineLabel: "Contenu CSS",
  inlinePlaceholder: "/* colle ton CSS personnalisé ici */",
  urlLabel: "URL",
  urlPlaceholder: "https://example.com/theme.css",
  customCssApply: "Appliquer le CSS",
  customCssClear: "Supprimer le CSS",
  customCssApplied: "CSS personnalisé appliqué",
  customCssCleared: "CSS personnalisé supprimé",
  customCssCurrent: "Actuellement actif",
  customCssNone: "Aucun CSS personnalisé appliqué",
  customCssHash: "Empreinte",
  resetAllSectionTitle: "Tout réinitialiser",
  resetAllLabel:
    "Restaurer l'apparence Tentacle par défaut (efface tokens et CSS personnalisé)",
  resetAllButton: "Réinitialiser tout",
  resetAllConfirm: "Réinitialiser tous les overrides du thème ?",
  saving: "Enregistrement...",
  saved: "Enregistré",
  errorPrefix: "Erreur",
  adminOnly: "Cette section est réservée aux administrateurs.",

  presetSectionTitle: "Thèmes saisonniers",
  presetSectionHelp:
    "Thèmes en un clic qui changent couleurs, polices, effets d'ambiance et ajoutent des accessoires saisonniers au logo Tentacle. Appliquer un thème efface les overrides manuels.",
  presetActive: "Actif",
  presetDefaultName: "Tentacle par défaut",
  presetDefaultDesc:
    "Apparence cinématographique originale — marque violette, ambiance sombre.",
  presetChristmasName: "Noël",
  presetChristmasDesc:
    "Bonnet de Père Noël sur le poulpe + soupçon de rouge et vert et fine neige.",
  presetEasterName: "Pâques",
  presetEasterDesc:
    "Oreilles de lapin sur le poulpe + touche pastel discrète et confettis lents.",
  presetHalloweenName: "Halloween",
  presetHalloweenDesc:
    "Chapeau de sorcière sur le poulpe + soupçon d'orange et toile d'araignée dans un coin.",

  tokensCardTitle: "Tous les tokens",
  tokensCardDescription:
    "Éditeur granulaire — surcharge individuellement n'importe lequel des 98 tokens de design.",
  tokensCardButton: "Ouvrir l'éditeur",
  tokensPageTitle: "Tous les tokens",
  tokensPageHelp:
    "Chaque token de design exposé par @tentacle-tv/theme. Les modifications se propagent au web, desktop, mobile et TV via /api/theme. Sauvegarde automatique après une courte pause.",
  tokensBackToTheme: "Retour au thème",
  tokensCategory_color: "Couleurs",
  tokensCategory_blur: "Flous",
  tokensCategory_shadow: "Ombres et élévation",
  tokensCategory_radius: "Rayons d'arrondi",
  tokensCategory_motion: "Motion (durées et easings)",
  tokensCategory_layout: "Layout (hauteurs et gouttières)",
  tokensCategory_component: "Tailles de composants",
  tokensCategory_spacing: "Échelle d'espacement",
  tokensCategory_typography: "Typographie",

  refCardTitle: "Référence pour génération IA",
  refCardDescription:
    "Un seul bloc copiable contenant toutes les classes CSS, variables, sélecteurs et un prompt prêt à donner à une IA pour générer un thème.",
  refCardButton: "Ouvrir la référence",
  refPageTitle: "Référence thème pour prompts IA",
  refPageHelp:
    "Copie le gros bloc ci-dessous dans ChatGPT, Claude ou n'importe quel LLM, décris ton idée de thème, colle le résultat dans le panneau CSS personnalisé. N'importe qui peut créer un thème Tentacle complet ainsi.",
  refAllInOneTitle: "Tout en un seul copier-coller",
  refAllInOneHelp:
    "Contient toutes les variables CSS, tous les sélecteurs utiles, toutes les keyframes d'animation, le mapping Tailwind, plus un modèle de prompt IA prêt à compléter à la fin.",
  refAllInOneBlockTitle: "Référence complète + modèle de prompt IA",
  refAllInOneBlockDesc:
    "Colle ce bloc entier à une IA, puis remplace la ligne entre crochets par ton idée de thème.",
  refExamplesTitle: "Exemples de presets fonctionnels",
  refExamplesHelp:
    "Trois CSS de presets livrés avec l'app. À utiliser comme référence stylistique ou point de départ.",
  refExampleXmasTitle: "Preset Noël (CSS complet)",
  refExampleEasterTitle: "Preset Pâques (CSS complet)",
  refExampleHalloweenTitle: "Preset Halloween (CSS complet)",
  refCopy: "Copier",
  refCopied: "Copié",
  refLines: "lignes",
  refChars: "caractères",
} as const;
