// MPRIS (Linux) — les VALEURS : propriétés lues par les clients (fil D-Bus), position extrapolée,
// `Metadata`, et la relecture des bancs (`debugState`, fil principal, PAR le bus).
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>

#include "media_session_linux.h"

namespace tentacle::media_session::mpris {
namespace {

// GVariant exige de l'UTF-8 valide (sinon un avertissement et AUCUNE valeur) : on répare.
GVariant* utf8(const std::string& s) {
  if (g_utf8_validate(s.data(), gssize(s.size()), nullptr)) return g_variant_new_string(s.c_str());
  return g_variant_new_take_string(g_utf8_make_valid(s.data(), gssize(s.size())));
}

const char* statusName(Status status) {
  switch (status) {
    case Status::Playing: return "Playing";
    case Status::Paused: return "Paused";
    case Status::Stopped: return "Stopped";
  }
  return "Stopped";
}

void appendString(std::string& out, const char* s) {
  out += '"';
  for (const unsigned char* p = reinterpret_cast<const unsigned char*>(s); *p; ++p) {
    switch (*p) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if (*p < 0x20) {
          char buf[8];
          std::snprintf(buf, sizeof buf, "\\u%04x", unsigned(*p));
          out += buf;
        } else {
          out += char(*p);
        }
    }
  }
  out += '"';
}

// Un GVariant en JSON (les types de MPRIS : b, x, d, s, o, as, a{sv}, v).
void appendJson(std::string& out, GVariant* v) {
  if (g_variant_is_of_type(v, G_VARIANT_TYPE_VARIANT)) {
    VariantPtr inner(g_variant_get_variant(v));
    return appendJson(out, inner.get());
  }
  if (g_variant_is_of_type(v, G_VARIANT_TYPE_BOOLEAN)) {
    out += g_variant_get_boolean(v) ? "true" : "false";
  } else if (g_variant_is_of_type(v, G_VARIANT_TYPE_INT64)) {
    out += std::to_string(g_variant_get_int64(v));
  } else if (g_variant_is_of_type(v, G_VARIANT_TYPE_DOUBLE)) {
    const double d = g_variant_get_double(v);
    char buf[32];
    std::snprintf(buf, sizeof buf, "%.17g", d);
    out += std::isfinite(d) ? buf : "null";
  } else if (g_variant_is_of_type(v, G_VARIANT_TYPE_STRING) || g_variant_is_of_type(v, G_VARIANT_TYPE_OBJECT_PATH)) {
    appendString(out, g_variant_get_string(v, nullptr));
  } else if (g_variant_is_of_type(v, G_VARIANT_TYPE_ARRAY)) {
    const bool dict = g_variant_is_of_type(v, G_VARIANT_TYPE("a{s*}"));
    out += dict ? '{' : '[';
    const gsize n = g_variant_n_children(v);
    for (gsize i = 0; i < n; ++i) {
      if (i) out += ',';
      VariantPtr child(g_variant_get_child_value(v, i));
      if (!dict) {
        appendJson(out, child.get());
        continue;
      }
      VariantPtr key(g_variant_get_child_value(child.get(), 0));
      VariantPtr value(g_variant_get_child_value(child.get(), 1));
      appendString(out, g_variant_get_string(key.get(), nullptr));
      out += ':';
      appendJson(out, value.get());
    }
    out += dict ? '}' : ']';
  } else {
    gchar* text = g_variant_print(v, FALSE);
    appendString(out, text);
    g_free(text);
  }
}

}  // namespace

double Service::positionMs() const {
  const Playback& p = state_.playback;
  double position = p.positionMs;
  // Même horloge que `Playback.atMs` (celle du cœur) : la position avance au rythme `rate`.
  if (p.status == Status::Playing) position += (monotonicMs() - p.atMs) * p.rate;
  if (p.durationMs && *p.durationMs > 0) position = std::min(position, *p.durationMs);
  return std::max(0.0, position);
}

int64_t Service::positionUs() const { return int64_t(std::llround(positionMs() * 1000.0)); }

std::string Service::trackId() const {
  // Hors de l'espace /org/mpris (réservé), et propre à CHAQUE titre.
  if (!state_.hasNow) return "/org/mpris/MediaPlayer2/TrackList/NoTrack";
  return "/org/tentacle/track/" + std::to_string(state_.track);
}

GVariant* Service::metadata() const {
  GVariantBuilder b;
  g_variant_builder_init(&b, G_VARIANT_TYPE_VARDICT);
  g_variant_builder_add(&b, "{sv}", "mpris:trackid", g_variant_new_object_path(trackId().c_str()));
  if (state_.hasNow) {
    const NowPlaying& now = state_.now;
    g_variant_builder_add(&b, "{sv}", "xesam:title", utf8(now.title));
    if (!now.artist.empty()) {
      GVariantBuilder artists;
      g_variant_builder_init(&artists, G_VARIANT_TYPE_STRING_ARRAY);
      g_variant_builder_add_value(&artists, utf8(now.artist));
      g_variant_builder_add(&b, "{sv}", "xesam:artist", g_variant_builder_end(&artists));
    }
    if (!now.album.empty()) g_variant_builder_add(&b, "{sv}", "xesam:album", utf8(now.album));
    if (const auto& d = state_.playback.durationMs; d && *d > 0)
      g_variant_builder_add(&b, "{sv}", "mpris:length", g_variant_new_int64(gint64(std::llround(*d * 1000.0))));
    // La COPIE disque, jamais l'adresse http (elle porte le jeton du compte).
    if (!state_.artUri.empty()) g_variant_builder_add(&b, "{sv}", "mpris:artUrl", utf8(state_.artUri));
  }
  return g_variant_builder_end(&b);
}

GVariant* Service::property(const char* iface, const char* name) const {
  if (std::strcmp(iface, kPlayerInterface) == 0) return playerProperty(name);
  if (std::strcmp(iface, kRootInterface) == 0) return rootProperty(name);
  return nullptr;
}

GVariant* Service::playerProperty(const std::string& name) const {
  const Playback& p = state_.playback;
  const Controls& c = state_.controls;
  if (name == "PlaybackStatus") return g_variant_new_string(state_.hasNow ? statusName(p.status) : "Stopped");
  if (name == "Metadata") return metadata();
  // La vitesse réelle (les clients extrapolent avec elle), jamais 0 (spécification).
  if (name == "Rate") return g_variant_new_double(p.rate > 0 ? p.rate : 1.0);
  if (name == "Position") return g_variant_new_int64(positionUs());
  if (name == "Volume" || name == "MinimumRate" || name == "MaximumRate") return g_variant_new_double(1.0);
  if (name == "CanGoNext") return g_variant_new_boolean(c.next);
  if (name == "CanGoPrevious") return g_variant_new_boolean(c.previous);
  if (name == "CanSeek") return g_variant_new_boolean(c.seek);
  // Toujours vrais : GNOME Shell ne montre pas un lecteur qui ne peut pas jouer.
  if (name == "CanPlay" || name == "CanPause" || name == "CanControl") return g_variant_new_boolean(TRUE);
  return nullptr;
}

GVariant* Service::rootProperty(const std::string& name) const {
  if (name == "Identity") return utf8(host_.identity);
  if (name == "DesktopEntry") return utf8(host_.desktopEntry);
  if (name == "CanQuit" || name == "CanRaise" || name == "HasTrackList") return g_variant_new_boolean(FALSE);
  if (name == "SupportedUriSchemes" || name == "SupportedMimeTypes") return g_variant_new_strv(nullptr, 0);
  return nullptr;
}

std::string debugJson(const Service& service) {
  std::string name;
  GDBusConnection* conn = service.published(name);
  if (!conn) return R"({"active":false,"bus":null,"player":null})";
  // Relu CHEZ le bus (comme un widget) : le fil D-Bus répond, ce fil-ci attend (1 s au plus).
  GError* error = nullptr;
  GVariant* reply = g_dbus_connection_call_sync(conn, name.c_str(), kObjectPath, "org.freedesktop.DBus.Properties",
                                                "GetAll", g_variant_new("(s)", kPlayerInterface),
                                                G_VARIANT_TYPE("(a{sv})"), G_DBUS_CALL_FLAGS_NONE, 1000, nullptr, &error);
  g_object_unref(conn);
  std::string out = R"({"active":true,"bus":)";
  appendString(out, name.c_str());
  out += R"(,"player":)";
  if (reply) {
    VariantPtr props(g_variant_get_child_value(reply, 0));
    appendJson(out, props.get());
    g_variant_unref(reply);
  } else {
    out += "null,\"error\":";
    appendString(out, error ? error->message : "?");
    g_clear_error(&error);
  }
  out += '}';
  return out;
}

}  // namespace tentacle::media_session::mpris
