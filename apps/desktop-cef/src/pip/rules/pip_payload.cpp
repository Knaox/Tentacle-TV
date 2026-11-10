#include "pip/rules/pip_payload.h"

#include <cmath>

namespace tentacle::pip {
namespace {

// `raw ?? {}` d'Electron : une commande sans charge reçoit un objet vide.
const Json& orEmpty(const Json& raw) {
  static const Json empty = Json::object();
  return raw.is_null() ? empty : raw;
}

std::string invalid(const std::string& command, const std::string& why) {
  return "arguments invalides pour " + command + ": " + why;
}

// z.number().int().min(64).max(8192) — un entier, même écrit 480.0.
std::optional<int> size(const Json& v) {
  if (!v.is_number()) return std::nullopt;
  const double d = v.get<double>();
  if (!std::isfinite(d) || std::floor(d) != d || d < 64 || d > 8192) return std::nullopt;
  return static_cast<int>(d);
}

// z.number().finite().min(-8192).max(8192)
std::optional<double> coordinate(const Json& v) {
  if (!v.is_number()) return std::nullopt;
  const double d = v.get<double>();
  if (!std::isfinite(d) || d < -8192 || d > 8192) return std::nullopt;
  return d;
}

std::optional<Mode> mode(const Json& v) {
  return v.is_string() ? tentacle::pip::parseMode(v.get<std::string>()) : std::nullopt;
}

// Un champ facultatif de zod : absent, ou valide — jamais `null`.
bool optionalSize(const Json& obj, const char* key, std::optional<int>& out) {
  if (!obj.contains(key)) return true;
  out = size(obj.at(key));
  return out.has_value();
}

}  // namespace

Parsed<OpenArgs> parseOpen(const Json& raw) {
  const Json& p = orEmpty(raw);
  if (!p.is_object()) return invalid("pip_open", "objet attendu");
  const auto m = mode(p.value("mode", Json()));
  const auto w = size(p.value("width", Json()));
  const auto h = size(p.value("height", Json()));
  if (!m) return invalid("pip_open", "mode");
  if (!w || !h) return invalid("pip_open", "width/height");
  return OpenArgs{*m, *w, *h};
}

Parsed<ModeArgs> parseMode(const Json& raw) {
  const Json& p = orEmpty(raw);
  if (!p.is_object()) return invalid("pip_mode", "objet attendu");
  ModeArgs args;
  const auto m = mode(p.value("mode", Json()));
  if (!m) return invalid("pip_mode", "mode");
  args.mode = *m;
  if (!optionalSize(p, "width", args.width) || !optionalSize(p, "height", args.height)) {
    return invalid("pip_mode", "width/height");
  }
  return args;
}

Parsed<ResizeArgs> parseResize(const Json& raw) {
  const Json& p = orEmpty(raw);
  if (!p.is_object()) return invalid("pip_resize", "objet attendu");
  const auto w = size(p.value("width", Json()));
  const auto h = size(p.value("height", Json()));
  if (!w || !h) return invalid("pip_resize", "width/height");
  return ResizeArgs{*w, *h};
}

Parsed<GestureArgs> parseGesture(const Json& raw) {
  const Json& p = orEmpty(raw);
  if (!p.is_object() || !p.contains("gesture")) return invalid("pip_gesture", "gesture");
  GestureArgs args;
  const Json& g = p.at("gesture");
  if (!g.is_null()) {
    if (!g.is_string()) return invalid("pip_gesture", "gesture");
    args.gesture = tentacle::pip::parseGesture(g.get<std::string>());
    if (!args.gesture) return invalid("pip_gesture", "gesture");
  }
  if (p.contains("grab")) {
    const Json& grab = p.at("grab");
    if (!grab.is_object()) return invalid("pip_gesture", "grab");
    const auto x = coordinate(grab.value("x", Json()));
    const auto y = coordinate(grab.value("y", Json()));
    if (!x || !y) return invalid("pip_gesture", "grab");
    args.grab = Point{*x, *y};
  }
  return args;
}

std::optional<std::string> checkEmpty(const std::string& command, const Json& raw) {
  if (orEmpty(raw).is_object()) return std::nullopt;
  return invalid(command, "objet attendu");
}

}  // namespace tentacle::pip
