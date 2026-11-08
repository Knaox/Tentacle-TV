#pragma once
// Le son de l'app (propriétaire : lecteur). Voir docs/INTERFACES.md (« Lecteur », « Son »).
//
// Par défaut, du VRAI son : sortie native du système (`coreaudio` sous macOS, PipeWire →
// PulseAudio → ALSA sous Linux, WASAPI sous Windows). Volume et sourdine appartiennent à la
// page, comme sous Electron (`volume`/`mute` de mpv, persistés par le front).
//
// Mode muet des bancs (`--mute` ou `TENTACLE_MUTE=1`) : `ao=null` + `mute=yes`, tenus par le
// lecteur — la page ne peut ni rallumer la sortie ni lever la sourdine.
//
// Sonde (`TENTACLE_SOUND_PROBE=1`, bancs du lecteur seulement) : la VRAIE sortie native est
// ouverte, mais les échantillons sont mis à zéro par un filtre (`af`) avant elle et mpv naît
// `mute=yes` : la page peut changer volume et sourdine (preuve que mpv suit), rien n'est audible.

#include <string>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

namespace tentacle::sound {

enum class Mode { Real, Muted, Probe };

// Lu à chaque appel : `TENTACLE_MUTE` (≠ vide et ≠ "0") l'emporte sur la sonde.
Mode mode();
inline bool silent() { return mode() == Mode::Muted; }

// `--mute` sur la ligne de commande : pose `TENTACLE_MUTE=1` pour tout le processus (lecteur
// vidéo, musique). À appeler tôt, avant la création des instances mpv.
void forceMute();

// Sortie audio native de la plateforme, au format de l'option `ao` de mpv.
const char* nativeOutput();

// Options mpv que le lecteur impose APRÈS celles de l'appelant (elles gagnent) selon le mode.
// `callerAo` : l'`ao` demandé par l'appelant (vide : aucun) — gardé en mode réel (bancs PCM).
// Sonde : si le filtre à zéro est refusé, le lecteur retombe sur `ao=null` (jamais de son).
std::vector<std::pair<std::string, std::string>> forcedOptions(const std::string& callerAo);

// Mode muet : une commande `set mute …` / `cycle mute` devient `set mute yes` ; le reste passe.
nlohmann::json guardMute(const nlohmann::json& args);

}  // namespace tentacle::sound
