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
  playbackModeDefault: "Default",
  playbackModeDefaultHint: "What ships out of the box: opening titles and the next-episode preview skip themselves, the recap and closing credits are offered to you.",
  playbackModeManual: "Offer it to me",
  playbackModeAutomatic: "Do it for me",
  playbackModeCustom: "Custom",
  playbackModeManualHint: "The player offers, you decide. Nothing happens on its own.",
  playbackModeAutomaticHint: "The player skips credits and plays the next episode. A film never closes on its own.",
  playbackModeCustomHint:
    "Your settings match neither mode. The detail is below; picking a mode will replace it.",
  playbackAdvancedToggle: "Advanced settings",
  playbackAdvancedOnDesktop:
    "Fine tuning — which passage, which delay, which trigger — is done from Tentacle on a computer. It follows your account and applies here.",
  playbackSegmentsTitle: "Passages within an episode",
  playbackSegmentsSummary: "Opening titles, recap, closing credits, preview.",
  upNextSummary: "The \"up next\" card, the countdown, and when to offer them.",
  playbackSegmentsHint: "The player never guesses: it only acts on passages the server marks for it.",
  playbackSettingsAccount: "These settings follow your account, on every device.",
  // Two buttons rather than a switch on television: with a remote, a sliding
  // thumb means nothing.
  reglageActive: "On",
  reglageDesactive: "Off",

  // L'aperçu vivant du panneau avancé : la vraie pilule du lecteur, montée dans
  // un cadre qui imite l'image. Voir `settings/PlaybackPreview.tsx`.
  previewTitle: "Preview",
  previewCaptionOff: "Nothing is shown: the passage plays like the rest of the film.",
  previewCaptionButton: "The button waits for your click. Without a click, nothing is skipped.",
  previewCaptionAuto: "The button fills up, then the passage is skipped. The cross stops the countdown.",
  previewCaptionAutoSilent: "The passage is skipped after {{seconds}}s, with nothing announcing it.",

  // L'aperçu de la fin d'épisode : les trois réglages y sont indépendants, et
  // c'est ce que les mots peinent à dire. Voir `NextEpisodePreview.tsx`.
  previewNextCaptionOff: "The end of the episode stays bare: no card appears.",
  previewNextCaptionCard: "The card waits for your click. Nothing starts without you.",
  previewNextCaptionCountdown: "The card counts down {{seconds}}s — then it stops there, starting nothing.",
  previewNextCaptionAuto: "After {{seconds}}s, the next episode starts.",
  previewNextEpisodeLabel: "S01E02",
  previewNextEpisodeTitle: "The next episode",

  // L'aperçu de l'affiche de fin — la vraie, mise à l'échelle dans le cadre.
  previewNextFinalCaptionOff: "At the very end, nothing shows: the player returns to the details page.",
  previewNextFinalCaptionCard: "At the very end, the poster offers what's next and waits for you.",
  previewNextFinalCaptionCountdown: "The poster counts down {{seconds}}s — then stops there, starting nothing.",
  previewNextFinalCaptionAuto: "After {{seconds}}s, the next episode starts — even if the credits card was dismissed.",
  previewNextFinalSynopsis: "A sample synopsis, to see the poster in place.",

  // Le détail qui encombrait chaque réglage, réuni derrière un repli.
  segmentsMoreTitle: "More about this",
  segmentsMoreNothing: "With no passage marked by the server, nothing is shown — whatever the setting above.",
  segmentsMoreDismiss: "The cross stops the countdown and takes the button off the picture for the rest of playback. It comes back as soon as the controls are shown.",
  segmentsMoreOutro: "During an episode's closing credits, the \"up next\" card takes the corner of the picture — the button steps aside for it.",

  segmentIntroTitle: "Opening titles",
  segmentIntroHint: "A series' opening, the one that comes back every episode.",
  segmentOutroTitle: "Closing credits — series",
  segmentOutroHint: "The button only appears when it leads somewhere — a scene after the credits, or the end of a film.",
  segmentOutroFilmTitle: "Closing credits — films",
  segmentOutroFilmHint: "On a film, the button leads to the post-credit scene, or ends playback.",
  segmentRecapTitle: "Recap of the previous episode",
  segmentRecapHint: "The “previously on”, at the start of an episode.",
  segmentPreviewTitle: "Preview of the next episode",
  segmentPreviewHint: "Glimpses of the next episode, cut in after the closing credits.",
  segmentActionLabel: "What the player does",
  segmentActionButton: "Offer a button",
  segmentActionAuto: "Skip on its own",
  segmentActionOff: "Do nothing",
  segmentCountdownTitle: "Show the countdown",
  segmentCountdownHint: "The button fills up during the delay. Without it the skip still happens, with no warning.",
  segmentDelayLabel: "Delay before skipping",
  segmentDelayHint: "How long you get to refuse before the player skips.",
  segmentDelayValue: "{{seconds}}s",
  segmentDelayImmediate: "Immediate",

  // End of episode — strictly independent settings: show the card, run the
  // countdown, play the next episode, show the end poster. Turning the
  // countdown off no longer hides the card, dismissing the card keeps the poster.
  upNextTitle: "At the end of an episode",
  upNextCardTitle: "Offer the next episode",
  upNextCardHint: "A small card offers the next episode, in a corner of the picture.",
  upNextCountdownTitle: "Show a countdown",
  upNextCountdownHint: "The card announces the time left.",
  upNextAutoPlayTitle: "Play the next episode on its own",
  upNextAutoPlayHint: "When the countdown runs out, the next episode starts.",
  upNextFinalCardTitle: "Show the end poster",
  upNextFinalCardHint:
    "At the very end of the episode, a full-screen poster offers what's next — even if the small card was dismissed. Without it, the player returns to the details page.",
  nextCountdownLabel: "Countdown length",
  nextCountdownHint: "A ceiling: if the episode ends sooner, the countdown fits itself to what is left.",
  upNextTriggerLabel: "When to offer what follows",
  upNextTriggerOutroStart: "At the start of the closing credits",
  upNextTriggerBeforeEnd: "Shortly before the end",
  upNextTriggerHint: "\"At the start of the closing credits\" follows what the server detected. \"Shortly before the end\" forces your threshold.",
  // Le repli « avant la fin » : facultatif, global, et par bibliothèque.
  beforeEndEnabledTitle: "Offer the next episode even with no credits detected",
  beforeEndEnabledHint: "With no credits detected, the player has no idea when the episode ends. This setting gives it a landmark.",
  beforeEndDefaultTitle: "Default threshold",
  beforeEndDefaultHint: "What applies to libraries no rule targets.",
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
