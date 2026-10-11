/**
 * The setup wizard in the "Tentacle Server" Windows app
 * (`packaging: "windows-app"`): the code screen's tab, and the `<key>_windowsApp`
 * variants of sentences that assume Docker (closed list:
 * `packages/shared/src/help/packagedHelp.ts`). Menu names are the host's
 * (`apps/server-windows`). Merged into `setupWizard`.
 */
export default {
  codeHelp_tab_windows: "Tentacle Server",
  codeHelp_windowsStep1: "Click the Tentacle Server icon in the notification area, at the right of the taskbar (under the ^ arrow if it is hidden).",
  codeHelp_windowsStep2: "Choose “Setup code”: the code shows up.",
  codeHelp_windowsConsole: "No code, or already used? In a terminal on this PC (PowerShell or Command Prompt), type the command below: it prints a new code.",
  codeHelp_intro_windowsApp: "Tentacle Server keeps the code at hand, on this PC:",
  codeWhereFile_windowsApp: "Or in the C:\\ProgramData\\Tentacle Server\\setup-token.txt file.",

  help_code_where_a_windowsApp: "On the server's PC: Tentacle Server icon in the notification area › Setup code. Or in the C:\\ProgramData\\Tentacle Server\\setup-token.txt file.",
  help_jellyfin_missing_a_windowsApp: "Type its address by hand: http://localhost:8096 if it runs on this PC, otherwise its machine's, for example http://192.168.1.20:8096.",
  help_libraries_missing_a_windowsApp: "These are the folders JELLYFIN sees. Installed as a Windows service, it does not see mapped network drives (Z:…): give their network path instead, for example \\\\NAS\\Movies.",
  help_done_reopen_a_windowsApp: "It closes for good once finished. To start over: the tentacle setup reset command in a terminal on this PC, then Tentacle Server icon › Restart server.",
  doneWebUiOff_windowsApp: "This server's web interface is turned off (tentacle web off): this page closes as soon as you leave it. Then use the apps; “tentacle web on”, in a terminal on this PC, turns it back on.",
};
