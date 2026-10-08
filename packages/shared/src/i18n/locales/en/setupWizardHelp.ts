/**
 * The setup wizard: “Need help?” at the foot of each screen — short
 * questions and answers, one list per step
 * (`packages/shared/src/setupWizard/setupHelp.ts`). Merged into `setupWizard`.
 */
export default {
  helpToggle: "Need help?",
  helpDoc: "Read the help page",

  help_welcome_what_q: "What does this wizard do?",
  help_welcome_what_a: "It links Tentacle to your Jellyfin, creates or reuses its administrator account and its libraries, then opens Tentacle for you. Nothing leaves your home.",
  help_welcome_time_q: "How long does it take?",
  help_welcome_time_a: "Five to ten minutes. Jellyfin may restart once, for segment detection.",

  help_code_where_q: "Where is the code?",
  help_code_where_a: "In the Tentacle container's log (Portainer: Containers › Tentacle › Logs; or docker logs), or in the data/setup-token.txt file.",
  help_code_why_q: "Why a code?",
  help_code_why_a: "You are not opening the wizard from your local network: the code proves you control the server.",

  help_jellyfin_kinds_q: "New or already set up?",
  help_jellyfin_kinds_a: "New: Tentacle creates its administrator account and libraries. Already set up: you sign in with the existing account, and Tentacle creates nothing (except libraries if it has none, if you want).",
  help_jellyfin_missing_q: "My Jellyfin is not in the list",
  help_jellyfin_missing_a: "Type its address by hand, for example http://192.168.1.20:8096. From a container, localhost means the container itself, not your server.",

  help_account_which_q: "Which account do I create?",
  help_account_which_a: "Jellyfin's administrator account, which also becomes yours in Tentacle: same name, same password.",
  help_account_stored_q: "Is the password stored?",
  help_account_stored_a: "No, never: it only passes through to Jellyfin.",

  help_signIn_which_q: "Which account?",
  help_signIn_which_a: "An administrator account that already exists on this Jellyfin. It becomes yours in Tentacle.",
  help_signIn_forgot_q: "I forgot the password",
  help_signIn_forgot_a: "Reset it in Jellyfin (its “Forgot password” procedure), then come back here.",

  help_libraries_what_q: "What is a library?",
  help_libraries_what_a: "A folder where Jellyfin looks for one kind of content: your movies on one side, your shows on the other.",
  help_libraries_missing_q: "I can't see my folders",
  help_libraries_missing_a: "These are the folders JELLYFIN sees. In a container, only mounted folders exist: in the full stack, /media is your MEDIA_PATH folder.",
  help_libraries_windows_q: "What if Jellyfin runs on Windows?",
  help_libraries_windows_a: "The PC's drives (C:, D:…) show at the root; pick for example D:\\Movies.",

  help_recommended_all_q: "Should I tick everything?",
  help_recommended_all_a: "No: everything is optional, and nothing changes without your tick. “Skip” touches nothing.",
  help_recommended_restart_q: "Will Jellyfin restart?",
  help_recommended_restart_a: "Only for segment detection, once, and never during playback.",

  help_tmdb_what_q: "What is TMDB for?",
  help_tmdb_what_a: "Jellyfin describes your library; Tentacle also asks The Movie Database about what lies beyond it: similar titles, cast, collections, streaming services.",
  help_tmdb_free_q: "How do I get a key?",
  help_tmdb_free_a: "Create a free account on themoviedb.org, then open the API section of its settings: request a key for personal use and copy the v3 API key (32 characters).",
  help_tmdb_later_q: "What if I add it later?",
  help_tmdb_later_a: "Tentacle works without it. Add it whenever you like in Administration › Metadata: the dashboard lists it among its recommendations, with no other reminder.",

  help_recap_what_q: "What will happen?",
  help_recap_what_a: "Tentacle does what is listed, in order, then signs you in. Nothing else.",
  help_recap_clientUrl_q: "Jellyfin's address for the apps?",
  help_recap_clientUrl_a: "The one your devices at home use to play directly, often http://server-address:port. You can change it later in Administration › Services.",

  help_apply_what_q: "Does it take long?",
  help_apply_what_a: "Usually under a minute; a bit longer if Jellyfin restarts for segment detection.",
  help_apply_failed_q: "A step failed",
  help_apply_failed_a: "“Retry” runs it again without redoing what succeeded. Segments and settings never block the end.",

  help_remote_needed_q: "Do I need to turn it on?",
  help_remote_needed_a: "No. Off, Tentacle works at home and nothing is exposed. Turn it on to watch away from home, now or later.",
  help_remote_proxy_q: "What is a reverse proxy?",
  help_remote_proxy_a: "A program that receives visits from the Internet and adds HTTPS. Tentacle installs none: if you don't have one, keep “No proxy”.",
  help_remote_nothing_q: "Nothing opens from outside",
  help_remote_nothing_a: "Your provider may share your address (CGNAT): see plan B, a private network like Tailscale.",

  help_done_missing_q: "My movies don't show up",
  help_done_missing_a: "Wait for Jellyfin's scan, or run it again (Dashboard › Libraries). Check they are in the library's folder.",
  help_done_reopen_q: "How do I reopen this wizard?",
  help_done_reopen_a: "It closes for good once finished. To start over: the tentacle setup reset command, inside the container.",
};
