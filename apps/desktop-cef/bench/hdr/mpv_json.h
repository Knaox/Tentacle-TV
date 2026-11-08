#pragma once
// mpv_node → JSON texte (preuves du banc HDR). Sans dépendance.

#include <mpv/client.h>

#include <cstdio>
#include <string>

namespace tentacle::bench {

inline void appendJsonString(std::string& out, const char* s) {
    out += '"';
    for (; s && *s; ++s) {
        const unsigned char c = (unsigned char)*s;
        if (c == '"' || c == '\\') { out += '\\'; out += (char)c; }
        else if (c < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", c); out += b; }
        else out += (char)c;
    }
    out += '"';
}

inline void appendNode(std::string& out, const mpv_node& n) {
    switch (n.format) {
        case MPV_FORMAT_STRING: appendJsonString(out, n.u.string); break;
        case MPV_FORMAT_FLAG: out += n.u.flag ? "true" : "false"; break;
        case MPV_FORMAT_INT64: out += std::to_string(n.u.int64); break;
        case MPV_FORMAT_DOUBLE: { char b[32]; snprintf(b, sizeof b, "%.6g", n.u.double_); out += b; break; }
        case MPV_FORMAT_NODE_ARRAY:
        case MPV_FORMAT_NODE_MAP: {
            const bool map = n.format == MPV_FORMAT_NODE_MAP;
            out += map ? '{' : '[';
            for (int i = 0; i < n.u.list->num; i++) {
                if (i) out += ',';
                if (map) { appendJsonString(out, n.u.list->keys[i]); out += ':'; }
                appendNode(out, n.u.list->values[i]);
            }
            out += map ? '}' : ']';
            break;
        }
        default: out += "null";
    }
}

inline std::string nodeToJson(const mpv_node& n) {
    std::string out;
    appendNode(out, n);
    return out;
}

}  // namespace tentacle::bench
