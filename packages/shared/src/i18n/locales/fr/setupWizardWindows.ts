/**
 * L'assistant d'installation dans l'app Windows « Tentacle Server »
 * (`packaging: "windows-app"`) : l'onglet de l'écran du code, et les variantes
 * `<clé>_windowsApp` des phrases qui supposent Docker (liste fermée :
 * `packages/shared/src/help/packagedHelp.ts`). Les noms du menu de l'icône
 * sont ceux de l'hôte (`apps/server-windows`). Fondu dans `setupWizard`.
 */
export default {
  codeHelp_tab_windows: "Tentacle Server",
  codeHelp_windowsStep1: "Cliquez sur l'icône Tentacle Server dans la zone de notification, à droite de la barre des tâches (sous la flèche ^ si elle est masquée).",
  codeHelp_windowsStep2: "Choisissez «\u00a0Code d'installation\u00a0»\u00a0: le code s'affiche.",
  codeHelp_windowsConsole: "Pas de code, ou déjà utilisé\u00a0? Dans un terminal de ce PC (PowerShell ou Invite de commandes), tapez la commande ci-dessous\u00a0: elle affiche un code neuf.",
  codeHelp_intro_windowsApp: "Tentacle Server garde le code à portée de main, sur ce PC\u00a0:",
  codeWhereFile_windowsApp: "Ou dans le fichier C:\\ProgramData\\Tentacle Server\\setup-token.txt.",

  help_code_where_a_windowsApp: "Sur le PC du serveur\u00a0: icône Tentacle Server de la zone de notification › Code d'installation. Ou dans le fichier C:\\ProgramData\\Tentacle Server\\setup-token.txt.",
  help_jellyfin_missing_a_windowsApp: "Tapez son adresse à la main\u00a0: http://localhost:8096 s'il tourne sur ce PC, sinon celle de sa machine, par exemple http://192.168.1.20:8096.",
  help_libraries_missing_a_windowsApp: "Ce sont les dossiers vus par JELLYFIN. Installé en service Windows, il ne voit pas les lecteurs réseau connectés (Z:…)\u00a0: donnez plutôt leur chemin réseau, par exemple \\\\NAS\\Films.",
  help_done_reopen_a_windowsApp: "Il se ferme pour de bon une fois fini. Pour tout recommencer\u00a0: la commande tentacle setup reset dans un terminal de ce PC, puis icône Tentacle Server › Redémarrer le serveur.",
  doneWebUiOff_windowsApp: "L'interface web de ce serveur est coupée (tentacle web off)\u00a0: cette page se fermera dès que vous la quitterez. Ensuite, utilisez les applications\u00a0; «\u00a0tentacle web on\u00a0», dans un terminal de ce PC, la rallume.",
};
