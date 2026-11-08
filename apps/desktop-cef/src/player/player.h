#pragma once
// Lecteur (propriétaire : vidéo-HDR) — une instance libmpv, pilotée de façon ASYNCHRONE.
// Voir docs/INTERFACES.md (« Lecteur »).
//
// Règles :
// - tous les appels se font depuis le fil principal (UI) ; tous les rappels y sont livrés
//   (via `PlayerOptions::post`, p. ex. `postToMain` du socle) ;
// - aucun appel mpv synchrone depuis le fil principal ni depuis un rappel : commandes,
//   écritures et LECTURES passent par les variantes *_async de libmpv (gel macOS sinon,
//   règle d'AGENTS.md de la référence et mesure de Tentacle) ;
// - le son : sortie native réelle par défaut ; `--mute`/`TENTACLE_MUTE=1` → `ao=null` +
//   `mute=yes` tenus par le lecteur (voir `player/sound_policy.h`).
//
// Vidéo : `attachVideoSurface()` avant le premier `loadfile` — mpv dessine alors dans la
// CAMetalLayer de la surface (contexte `moltenvk` de notre libmpv, HDR passthrough par
// `target-colorspace-hint=yes`). Sans surface, AUCUNE sortie vidéo n'existe (`vo=null`) : mpv
// n'ouvre jamais de fenêtre à lui. Mode musique : `audioOnly` (vid=no, aucune couche, jamais).

#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

namespace tentacle {

class VideoSurface;
using Json = nlohmann::json;

enum class PropFormat { Flag, Int64, Double, String, Node };

struct PlayerOptions {
    // Pose un travail sur le fil principal ; appelable depuis n'importe quel fil. Obligatoire.
    std::function<void(std::function<void()>)> post;
    // Options mpv posées avant mpv_initialize (après nos valeurs par défaut, donc prioritaires
    // — sauf les options de sortie vidéo, tenues par le lecteur, et le son en mode muet).
    // `ao` absent : la sortie native (`sound::nativeOutput()`).
    std::vector<std::pair<std::string, std::string>> options;
    // Audio seul (mode musique) : vid=no, audio-display=no ; attachVideoSurface() refusée.
    bool audioOnly = false;
    std::string logFile;           // journal libmpv (vide : aucun)
    std::string logLevel = "info"; // niveau du journal libmpv si logFile est posé
};

// Erreur (message de mpv) ou rien ; `result` : donnée de la réponse (`loadfile` :
// `{"playlist_entry_id": n}`), `null` sinon.
using PlayerDone = std::function<void(std::optional<std::string> error, const Json& result)>;

class Player {
public:
    // nullptr si libmpv refuse de démarrer (`error` reçoit la raison).
    static std::unique_ptr<Player> create(PlayerOptions options, std::string* error = nullptr);
    ~Player();  // équivaut à destroy({}) si destroy n'a pas été appelé
    Player(const Player&) = delete;
    Player& operator=(const Player&) = delete;

    // `args` : tableau (["seek", 30, "relative"]) ou objet nommé ({"name": "loadfile", …}).
    void command(const Json& args, PlayerDone done = {});
    void setProperty(const std::string& name, const Json& value, PlayerDone done = {});
    // Valeur typée par mpv, ou nullopt (propriété absente / indisponible).
    void getProperty(const std::string& name, std::function<void(std::optional<Json>)> done);
    // Valeur initiale puis chaque changement ; `null` quand mpv n'a pas de valeur.
    uint64_t observe(const std::string& name, PropFormat format,
                     std::function<void(const Json& value)> cb);
    void unobserve(uint64_t id);
    // Évènements libmpv : `{"event": "<nom mpv>", …}`. `start-file`/`end-file` portent
    // `playlist_entry_id` ; `end-file` : `reason` et `error` NUMÉRIQUES (MPV_END_FILE_REASON_*).
    void onEvent(std::function<void(const Json& event)> cb);

    // Vidéo. La surface doit vivre tant qu'elle est attachée (le compositeur la range).
    bool attachVideoSurface(VideoSurface& surface);
    // Coupe la sortie vidéo (vo=null) ; la lecture audio continue. La surface peut ensuite
    // être détruite : mpv garde sa propre référence sur la couche jusqu'à la fin de son VO.
    void detachVideoSurface();
    VideoSurface* videoSurface() const;

    // Arrêt asynchrone : `quit`, puis libération hors du fil principal ; `done` sur le fil
    // principal. Plus aucun rappel n'est livré ensuite (sauf `done`).
    void destroy(std::function<void()> done);

    struct Impl;

private:
    explicit Player(std::shared_ptr<Impl> impl);
    std::shared_ptr<Impl> impl_;
};

// Ce que libmpv sait faire ici, pour le diagnostic (version, contextes GPU disponibles).
std::string playerLibraryInfo();

}  // namespace tentacle
