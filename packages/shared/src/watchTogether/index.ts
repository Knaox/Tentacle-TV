// Watch Together — les règles pures partagées par tous les clients (web,
// bureau, mobile) : état de salle, effets d'un état, « tous prêts », et
// l'arithmétique de la synchronisation. Les crochets React vivent dans
// `@tentacle-tv/api-client` (`watchTogether/`).
export * from "./roomState";
export * from "./sessionRules";
export * from "./readyGate";
export * from "./groupSchedule";
// Le sélecteur d'emojis du chat : les mêmes réactions partout.
export * from "./emojiData";
// Ce qu'on dit d'un membre, et de l'affinité (types, noms).
export * from "./memberPresentation";
export * from "./affinityText";
// « X est en train d'écrire… » : le libellé.
export * from "./typingLabel";
// Les modèles purs de l'interface (feuilles, bande d'accueil, panneau du lecteur).
export * from "./ui";
