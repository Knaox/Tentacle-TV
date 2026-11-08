#include "player/mpv_node.h"

#include <cstdlib>
#include <cstring>

namespace tentacle::player_detail {

Json toJson(mpv_format format, const void* data) {
    if (!data) return nullptr;
    switch (format) {
        case MPV_FORMAT_STRING:
        case MPV_FORMAT_OSD_STRING: {
            const char* s = *static_cast<char* const*>(data);
            return s ? Json(s) : Json(nullptr);
        }
        case MPV_FORMAT_FLAG: return *static_cast<const int*>(data) != 0;
        case MPV_FORMAT_INT64: return *static_cast<const int64_t*>(data);
        case MPV_FORMAT_DOUBLE: return *static_cast<const double*>(data);
        case MPV_FORMAT_NODE: {
            const mpv_node& n = *static_cast<const mpv_node*>(data);
            switch (n.format) {
                case MPV_FORMAT_STRING: return n.u.string ? Json(n.u.string) : Json(nullptr);
                case MPV_FORMAT_FLAG: return n.u.flag != 0;
                case MPV_FORMAT_INT64: return n.u.int64;
                case MPV_FORMAT_DOUBLE: return n.u.double_;
                case MPV_FORMAT_NODE_ARRAY: {
                    Json arr = Json::array();
                    for (int i = 0; i < n.u.list->num; i++) arr.push_back(toJson(n.u.list->values[i]));
                    return arr;
                }
                case MPV_FORMAT_NODE_MAP: {
                    Json obj = Json::object();
                    for (int i = 0; i < n.u.list->num; i++)
                        obj[n.u.list->keys[i]] = toJson(n.u.list->values[i]);
                    return obj;
                }
                case MPV_FORMAT_BYTE_ARRAY: return Json::binary({});
                default: return nullptr;
            }
        }
        default: return nullptr;
    }
}

namespace {

// Remplit `n` depuis `j` ; les chaînes et listes sont allouées par malloc/calloc et
// libérées par freeNode.
void fill(mpv_node& n, const Json& j) {
    if (j.is_string()) {
        n.format = MPV_FORMAT_STRING;
        n.u.string = strdup(j.get_ref<const std::string&>().c_str());
    } else if (j.is_boolean()) {
        n.format = MPV_FORMAT_FLAG;
        n.u.flag = j.get<bool>() ? 1 : 0;
    } else if (j.is_number_integer()) {
        n.format = MPV_FORMAT_INT64;
        n.u.int64 = j.get<int64_t>();
    } else if (j.is_number()) {
        n.format = MPV_FORMAT_DOUBLE;
        n.u.double_ = j.get<double>();
    } else if (j.is_array() || j.is_object()) {
        const bool map = j.is_object();
        n.format = map ? MPV_FORMAT_NODE_MAP : MPV_FORMAT_NODE_ARRAY;
        auto* list = static_cast<mpv_node_list*>(calloc(1, sizeof(mpv_node_list)));
        list->num = static_cast<int>(j.size());
        list->values = static_cast<mpv_node*>(calloc(j.size() ? j.size() : 1, sizeof(mpv_node)));
        if (map) list->keys = static_cast<char**>(calloc(j.size() ? j.size() : 1, sizeof(char*)));
        int i = 0;
        for (auto it = j.begin(); it != j.end(); ++it, ++i) {
            if (map) list->keys[i] = strdup(it.key().c_str());
            fill(list->values[i], *it);
        }
        n.u.list = list;
    } else {
        n.format = MPV_FORMAT_NONE;
    }
}

void freeNode(mpv_node& n) {
    if (n.format == MPV_FORMAT_STRING) {
        free(n.u.string);
    } else if (n.format == MPV_FORMAT_NODE_ARRAY || n.format == MPV_FORMAT_NODE_MAP) {
        for (int i = 0; i < n.u.list->num; i++) {
            freeNode(n.u.list->values[i]);
            if (n.u.list->keys) free(n.u.list->keys[i]);
        }
        free(n.u.list->values);
        free(n.u.list->keys);
        free(n.u.list);
    }
    n.format = MPV_FORMAT_NONE;
}

}  // namespace

OwnedNode::OwnedNode(const Json& j) { fill(node_, j); }
OwnedNode::~OwnedNode() { freeNode(node_); }

Json eventJson(const mpv_event* e) {
    Json ev = {{"event", mpv_event_name(e->event_id)}};
    if (e->event_id == MPV_EVENT_START_FILE) {
        ev["playlist_entry_id"] = static_cast<mpv_event_start_file*>(e->data)->playlist_entry_id;
    } else if (e->event_id == MPV_EVENT_END_FILE) {
        auto* ef = static_cast<mpv_event_end_file*>(e->data);
        ev["reason"] = static_cast<int>(ef->reason);
        ev["error"] = ef->error;
        ev["playlist_entry_id"] = ef->playlist_entry_id;
    } else if (e->event_id == MPV_EVENT_LOG_MESSAGE) {
        auto* lm = static_cast<mpv_event_log_message*>(e->data);
        ev["prefix"] = lm->prefix;
        ev["level"] = lm->level;
        ev["text"] = lm->text;
    }
    return ev;
}

}  // namespace tentacle::player_detail
