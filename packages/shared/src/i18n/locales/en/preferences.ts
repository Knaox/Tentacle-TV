export default {
  changePasswordTitle: "Password",
  changePasswordDescription: "Change your Jellyfin account password. Your current password is required.",
  currentPassword: "Current password",
  newPassword: "New password",
  confirmNewPassword: "Confirm new password",
  passwordTooShort: "The new password must be at least 6 characters",
  passwordMismatch: "Passwords do not match",
  passwordChanged: "Password changed successfully",
  passwordChanging: "Changing...",
  passwordChangeError: "Failed to change password",
  showPassword: "Show password",
  hidePassword: "Hide password",
  title: "Language preferences",
  subtitle: "Configure default audio and subtitle tracks for each library.",
  interfaceLanguage: "Interface language",
  offlineSavedLocally: "Offline: changes are saved locally and will sync once back online.",
  offlineNoCacheHint: "Libraries unknown offline — go online once so they can be remembered.",
  appearance: "Appearance",
  appearanceDescription: "Choose the app theme.",
  theme: "Theme",
  themeLight: "Light",
  themeDark: "Dark",
  themeAuto: "Auto",
  themeAutoHint: "Follows the system setting",
  effects: "Effects",
  liquidGlassTitle: "Liquid Glass",
  // Deliberately platform-neutral: mobile uses the native iOS 26 rendering,
  // web uses an SVG refraction. Naming iOS here would be wrong on desktop,
  // where this same key is displayed.
  liquidGlassDescription: "Adds refraction to translucent surfaces. When off, the app falls back to the classic glass effect.",
  liquidGlassUnavailable: "Not available on this rendering engine — the classic glass effect is used.",

  // ── Settings shell sections ──
  // Umbrella title of the screen (mobile landing). `title` remains the
  // historical title of the Playback page alone ("Language preferences").
  settingsTitle: "Settings",
  sectionAccount: "Account",
  sectionSecurity: "Security",
  sectionAppearance: "Appearance",
  sectionPlayback: "Playback",
  sectionDownloads: "Downloads",
  sectionData: "Data",
  sectionHelp: "Help",
  sectionDanger: "Danger zone",
  back: "Back",

  // ── Security (consolidates what was scattered across 4 screens) ──
  securityDescription: "Password, paired devices and server connection.",
  securityPassword: "Password",
  securityPasswordHint: "Change your Jellyfin account password",
  securityDevices: "My paired devices",
  securityDevicesHint: "Televisions and apps authorised on this account",
  securityServer: "Server",
  securityServerHint: "Switch Tentacle server",
  audio: "Audio",
  subtitles: "Subtitles",
  subtitleMode: "Subtitle mode",
  default: "Default",
  none: "None",
  reset: "Reset",
  modeDisabled: "Disabled",
  modeAlwaysOn: "Always on",
  modeForcedOnly: "Forced only",
  modeSignsSongs: "Signs & Songs",
  langFr: "French",
  langFrVff: "French VFF",
  langFrVfq: "French VFQ",
  langEn: "English",
  langJa: "Japanese",
  langDe: "German",
  langEs: "Spanish",
  langIt: "Italian",
  langPt: "Portuguese",
  langRu: "Russian",
  langKo: "Korean",
  langZh: "Chinese",
  langAr: "Arabic",
  langPl: "Polish",
  langNl: "Dutch",
  langCs: "Czech",
  langHi: "Hindi",
  langTh: "Thai",
  langSv: "Swedish",
  langNo: "Norwegian",
  langFi: "Finnish",
  langTr: "Turkish",
  langHu: "Hungarian",
  langRo: "Romanian",
  langEl: "Greek",
  langDa: "Danish",
  langHe: "Hebrew",
  langVi: "Vietnamese",
  langId: "Indonesian",
  langMs: "Malay",
  langUk: "Ukrainian",
  langBg: "Bulgarian",
  langHr: "Croatian",
  langSr: "Serbian",
  langCa: "Catalan",
  langTa: "Tamil",
  langTe: "Telugu",
  langFa: "Persian",

  // Display HDR switching (Windows desktop with the native player)
  hdrAutoTitle: "Switch the display to HDR during playback",
  hdrAutoHint:
    "HDR films then show their full range of colour. Changing mode blacks the screen out for a second or two, and the original state is restored when playback ends. Left off, the film is adapted to your display without changing its mode.",
  // Graphics session choice (Linux desktop with native player)
  linuxSessionTitle: "Video display (Wayland or X11)",
  linuxSessionHint:
    "Wayland enables HDR. On KDE Plasma, playback follows your window — windowed or fullscreen, like everywhere else. On other Wayland desktops, native playback is always fullscreen (the display system does not let an application position its windows); X11 then remains the windowed fallback, without HDR. “Auto” follows the desktop session. The change takes effect on next launch.",
  linuxSessionAuto: "Auto — follow the desktop",
  linuxSessionWayland: "Wayland — built-in HDR support",
  linuxSessionX11: "X11 — no HDR",
  linuxSessionCurrent: "Current mode: {{montage}}",
  linuxSessionRestart: "Restart now",
  // One-time toast on the first native playback under Wayland — points here.
  linuxSessionFullscreenToast:
    "Fullscreen playback: under Wayland, it is the price of HDR. To watch in a window, an X11 setting is available in Preferences.",

  // Episode passages and end of episode. These settings follow the ACCOUNT,
  // not the device: what you set on the laptop applies in front of the TV.
  //
  // Le MODE est en tête parce que c'est la seule question que la plupart des
  // gens se posent ; le détail vit sous un repli.
  playbackModeTitle: "Skipping and autoplay",
  playbackModeLabel: "What the player does",
  playbackModeManual: "Offer it to me",
  playbackModeAutomatic: "Do it for me",
  playbackModeCustom: "Custom",
  playbackModeManualHint:
    "The player shows a button and waits for you. It skips nothing and never chains episodes.",
  playbackModeAutomaticHint:
    "The player skips credits and recaps after a short delay, and plays the next episode. A film never closes on its own.",
  playbackModeCustomHint:
    "Your settings match neither mode. The detail is below; picking a mode will replace it.",
  playbackAdvancedToggle: "Advanced settings",
  playbackAdvancedOnDesktop:
    "Fine tuning — which passage, which delay, which trigger — is done from Tentacle on a computer. It follows your account and applies here.",
  playbackSegmentsTitle: "Passages within an episode",
  playbackSegmentsSummary: "Opening titles, recap, closing credits, preview.",
  upNextSummary: "The \"up next\" card, the countdown, and when to offer them.",
  playbackSegmentsHint:
    "When the server marks a passage — opening titles, recap, preview — the player can offer to skip it, skip it on its own, or do nothing. Nothing is shown when nothing is marked: these settings never guess.",
  playbackSettingsAccount: "These settings follow your account, on every device.",
  // Two buttons rather than a switch on television: with a remote, a sliding
  // thumb means nothing.
  reglageActive: "On",
  reglageDesactive: "Off",

  segmentIntroTitle: "Opening titles",
  segmentIntroHint: "A series' opening, the one that comes back every episode.",
  segmentOutroTitle: "Closing credits",
  segmentOutroHint:
    "When a next episode exists, the “up next” card takes over the credits. The button only appears when it leads somewhere else: a scene after the credits, or the end of a film.",
  segmentRecapTitle: "Recap of the previous episode",
  segmentRecapHint: "The “previously on”, at the start of an episode.",
  segmentPreviewTitle: "Preview of the next episode",
  segmentPreviewHint: "Glimpses of the next episode, cut in after the closing credits.",
  segmentActionLabel: "What the player does",
  segmentActionButton: "Offer a button",
  segmentActionAuto: "Skip on its own",
  segmentActionOff: "Do nothing",
  segmentCountdownTitle: "Show the countdown",
  segmentCountdownHint:
    "The button fills up during the delay. The cross is always there: it stops the countdown and takes the button off the picture for the rest of playback — it comes back whenever the controls are shown.",
  segmentDelayLabel: "Delay before skipping",
  segmentDelayHint: "How long you get to refuse before the player skips.",
  segmentDelayValue: "{{seconds}}s",
  segmentDelayImmediate: "Immediate",

  // End of episode — THREE strictly independent settings: show the card, run
  // the countdown, play the next episode. Turning the countdown off no longer
  // hides the card.
  upNextTitle: "At the end of an episode",
  upNextCardTitle: "Offer the next episode",
  upNextCardHint:
    "During the closing credits, a small card offers the next episode in a corner of the picture. Turned off, the end of the episode stays bare. The end screen still appears at the very last moment.",
  upNextCountdownTitle: "Show a countdown",
  upNextCountdownHint:
    "The card and the end screen announce the time left. Without it, the card is simply an offer, waiting for you.",
  upNextAutoPlayTitle: "Play the next episode on its own",
  upNextAutoPlayHint:
    "When the countdown runs out, the next episode starts. This setting therefore needs the countdown above: without it, nothing fires.",
  upNextTriggerLabel: "When to offer what follows",
  upNextTriggerOutroStart: "At the start of the closing credits",
  upNextTriggerBeforeEnd: "Shortly before the end",
  upNextTriggerHint:
    "\"At the start of the closing credits\" follows what the server detected, and only falls back to the threshold below when it detected nothing — so the two can never contradict each other. \"Shortly before the end\" forces your threshold, even when credits are known.",
  // Le repli « avant la fin » : facultatif, global, et par bibliothèque.
  beforeEndEnabledTitle: "Offer the next episode even with no credits detected",
  beforeEndEnabledHint:
    "When the server marks no closing credits, the player has no idea when the episode ends. This setting gives it a landmark. Turned off, the end of those episodes stays bare — better nothing than a card dropped at random.",
  beforeEndDefaultTitle: "Default threshold",
  beforeEndDefaultHint:
    "What applies to libraries no rule targets. As a proportion it fits every format with no tuning: 98% is twenty-eight seconds on a 23-minute anime and forty on an hour-long series.",
  beforeEndModeLabel: "Count in",
  beforeEndModePercent: "Percentage",
  beforeEndModeSeconds: "Seconds",
  beforeEndPercentLabel: "Share of the media already watched",
  beforeEndPercentValue: "{{value}}%",
  beforeEndSecondsLabel: "Time left",
  beforeEndSecondsValue: "{{value}}s",
  beforeEndAddRule: "Add a rule",
  beforeEndRuleTitle: "Rule {{index}}",
  beforeEndRemoveRule: "Remove",

  upNextNeedsCard: "Without the card above, this setting has nothing to count down.",
  upNextNeedsCountdown: "Without the countdown above, nothing is triggered.",
  upNextBeforeEndLabel: "How long before the end",
  upNextBeforeEndValue: "{{seconds}}s",
  upNextBeforeEndHint:
    "Also used when the closing credits are not marked: the card then appears that long before the end.",

  // Décodage matériel — réglage d'APPAREIL, visible seulement sur le bureau.
  hwDecodeTitle: "Hardware decoding",
  hwDecodeHint:
    "What decodes the video: the graphics card, or the processor. If some videos show up as large coloured blocks while they look fine elsewhere, this is the setting to change.",
  hwDecodeAuto: "Automatic",
  hwDecodeCopy: "Memory copy",
  hwDecodeOff: "Software",
  hwDecodeAutoHint: "The player picks the decoder best suited to your graphics card.",
  hwDecodeCopyHint:
    "The card decodes, but the picture goes through memory before display. Slightly more costly, and it fixes broken images caused by a temperamental driver.",
  hwDecodeOffHint:
    "The processor decodes on its own. The safest and the hungriest — keep it for when the other two fail.",

  hdrAutoUnsupported:
    "No HDR-capable display was detected. HDR films are still adapted to your display, with nothing lost.",
} as const;
