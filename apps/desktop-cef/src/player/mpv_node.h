#pragma once
// Conversions mpv_node ↔ nlohmann::json (le `Json` du proto). Internes au lecteur.

#include <mpv/client.h>

#include <nlohmann/json.hpp>

#include <memory>

namespace tentacle::player_detail {

using Json = nlohmann::json;

// mpv_node (ou donnée typée par `format`) → Json. `null` pour MPV_FORMAT_NONE.
Json toJson(mpv_format format, const void* data);
inline Json toJson(const mpv_node& n) { return toJson(MPV_FORMAT_NODE, &n); }

// Évènement libmpv → `{"event": "<nom mpv>", …}` (`start-file`/`end-file` : `playlist_entry_id` ;
// `end-file` : `reason`, `error` numériques ; `log-message` : `prefix`, `level`, `text`).
Json eventJson(const mpv_event* e);

// Json → mpv_node possédé (libéré avec l'objet). Les nombres entiers restent entiers, les
// booléens deviennent des flags, les objets des NODE_MAP.
class OwnedNode {
public:
    explicit OwnedNode(const Json& j);
    ~OwnedNode();
    OwnedNode(const OwnedNode&) = delete;
    OwnedNode& operator=(const OwnedNode&) = delete;
    mpv_node* get() { return &node_; }

private:
    mpv_node node_{};
};

}  // namespace tentacle::player_detail
