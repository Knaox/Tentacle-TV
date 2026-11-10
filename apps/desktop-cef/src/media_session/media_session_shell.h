// La colle de « À l'écoute » avec l'app : les canaux d'Electron (`smtc_init`, `smtc_clear`,
// `smtc_set_playback`, `smtc_set_metadata`, `set_audio_session_name`, évènement
// `smtc-button`), un canal propre à CEF (`smtc_set_controls`), la musique (ce que le moteur
// d'Octave joue) et la vidéo (position du lecteur).
//
// `smtc_set_controls` est la CAPACITÉ qui dit au front que la coquille publie « À l'écoute »
// sur tous les systèmes : Electron ne la déclare pas (son `useSmtc` reste réservé à
// Windows, et la musique n'envoie pas sa fiche) ; CEF la déclare partout.
#pragma once

namespace bridge {
class Registry;
}

namespace tentacle {
struct AppContext;
}

namespace tentacle::media_session {

// Depuis `src/app/modules.cpp`, APRÈS octave (il en observe les canaux), AVANT le shim.
void install(AppContext& ctx, bridge::Registry& registry);
// À la fermeture : la session disparaît, les touches reviennent au système.
void shutdown();

}  // namespace tentacle::media_session
