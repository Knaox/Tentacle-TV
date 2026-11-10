#include "glass/validate.h"

#include <cctype>
#include <cmath>

namespace tentacle::glass {
namespace {

using Json = nlohmann::json;

/// Au-delà, ce n'est plus une fenêtre : c'est une valeur folle.
constexpr double kCoordLimit = 100'000;

/// `z.number().finite()` entre deux bornes. Un champ absent ou `null` ne passe pas.
bool numberIn(const Json& object, const char* key, double lo, double hi, double& out) {
  const auto it = object.find(key);
  if (it == object.end() || !it->is_number()) return false;
  const double v = it->get<double>();
  if (!std::isfinite(v) || v < lo || v > hi) return false;
  out = v;
  return true;
}

/// Un champ facultatif : absent → rien ; présent → doit valoir (le `null` est refusé, comme zod).
template <typename Parse>
bool optional(const Json& object, const char* key, Parse parse) {
  const auto it = object.find(key);
  if (it == object.end()) return true;
  return parse(*it);
}

bool isId(const Json& value) {
  if (!value.is_string()) return false;
  const size_t length = utf16Length(value.get_ref<const std::string&>());
  return length >= 1 && length <= static_cast<size_t>(kMaxIdLength);
}

bool parseEase(const Json& value, Ease& out) {
  if (!value.is_array() || value.size() != 4) return false;  // z.tuple : exactement quatre
  for (size_t i = 0; i < 4; ++i) {
    if (!value[i].is_number()) return false;
    const double v = value[i].get<double>();
    if (!std::isfinite(v) || v < 0 || v > 1) return false;
    out[i] = v;
  }
  return true;
}

bool parseMaterialize(const Json& value, Materialize& m) {
  if (!value.is_object()) return false;
  return numberIn(value, "rise", -200, 200, m.rise) && numberIn(value, "scale", 0.5, 1.5, m.scale) &&
         numberIn(value, "originX", 0, 1, m.originX) && numberIn(value, "originY", 0, 1, m.originY) &&
         numberIn(value, "delay", 0, kMaxTransitionMs, m.delay) &&
         numberIn(value, "exit", 0, kMaxTransitionMs, m.exit) && value.contains("enterEase") &&
         parseEase(value["enterEase"], m.enterEase) && value.contains("exitEase") &&
         parseEase(value["exitEase"], m.exitEase);
}

std::optional<Level> parseLevel(const Json& value) {
  if (!value.is_string()) return std::nullopt;
  const auto& s = value.get_ref<const std::string&>();
  if (s == "regular") return Level::Regular;
  if (s == "clear") return Level::Clear;
  if (s == "tinted") return Level::Tinted;
  if (s == "prominent") return Level::Prominent;
  return std::nullopt;
}

std::optional<Appearance> parseAppearance(const Json& value) {
  if (!value.is_string()) return std::nullopt;
  const auto& s = value.get_ref<const std::string&>();
  if (s == "dark") return Appearance::Dark;
  if (s == "light") return Appearance::Light;
  return std::nullopt;
}

std::optional<Region> parseRegion(const Json& raw) {
  if (!raw.is_object()) return std::nullopt;
  Region r;
  if (!raw.contains("id") || !isId(raw["id"])) return std::nullopt;
  r.id = raw["id"].get<std::string>();
  if (!numberIn(raw, "x", -kCoordLimit, kCoordLimit, r.x) || !numberIn(raw, "y", -kCoordLimit, kCoordLimit, r.y) ||
      !numberIn(raw, "width", 0, kCoordLimit, r.width) || !numberIn(raw, "height", 0, kCoordLimit, r.height) ||
      !numberIn(raw, "radius", 0, kCoordLimit, r.radius) || !numberIn(raw, "z", -kCoordLimit, kCoordLimit, r.z))
    return std::nullopt;
  const auto level = raw.contains("level") ? parseLevel(raw["level"]) : std::nullopt;
  if (!level) return std::nullopt;
  r.level = *level;
  // `tint` est REQUIS, `null` permis (z.string().regex().nullable()).
  const auto tint = raw.find("tint");
  if (tint == raw.end()) return std::nullopt;
  if (tint->is_string()) {
    if (!isTint(tint->get_ref<const std::string&>())) return std::nullopt;
    r.tint = tint->get<std::string>();
  } else if (!tint->is_null()) {
    return std::nullopt;
  }
  const auto interactive = raw.find("interactive");
  if (interactive == raw.end() || !interactive->is_boolean()) return std::nullopt;
  r.interactive = interactive->get<bool>();
  const bool ok =
      optional(raw, "group", [&](const Json& v) { return isId(v) && (r.group = v.get<std::string>(), true); }) &&
      optional(raw, "spacing", [&](const Json&) {
        double d = 0;
        return numberIn(raw, "spacing", 0, 1000, d) && (r.spacing = d, true);
      }) &&
      optional(raw, "transition", [&](const Json&) {
        double d = 0;
        return numberIn(raw, "transition", 0, kMaxTransitionMs, d) && (r.transition = d, true);
      }) &&
      optional(raw, "spring", [&](const Json& v) {
        SpringSpec s;
        if (!v.is_object() || !numberIn(v, "response", 0.05, 5, s.response) ||
            !numberIn(v, "dampingFraction", 0.1, 4, s.dampingFraction))
          return false;
        r.spring = s;
        return true;
      }) &&
      optional(raw, "appearance", [&](const Json& v) {
        const auto a = parseAppearance(v);
        return a && (r.appearance = *a, true);
      }) &&
      optional(raw, "materialize", [&](const Json& v) {
        Materialize m;
        return parseMaterialize(v, m) && (r.materialize = m, true);
      });
  if (!ok) return std::nullopt;
  return r;
}

}  // namespace

bool isTint(std::string_view text) {
  if (text.size() != 7 && text.size() != 9) return false;
  if (text[0] != '#') return false;
  for (size_t i = 1; i < text.size(); ++i)
    if (!std::isxdigit(static_cast<unsigned char>(text[i]))) return false;
  return true;
}

size_t utf16Length(std::string_view utf8) {
  size_t units = 0;
  for (size_t i = 0; i < utf8.size(); ++i) {
    const auto c = static_cast<unsigned char>(utf8[i]);
    if ((c & 0xC0) == 0x80) continue;  // octet de suite
    units += c >= 0xF0 ? 2 : 1;        // hors du plan de base : une paire de substitution
  }
  return units;
}

std::optional<ParsedBatch> parseBatch(const Json& raw) {
  constexpr size_t kMaxItems = static_cast<size_t>(kMaxRegions) * 4;
  if (!raw.is_object()) return std::nullopt;
  const auto upserts = raw.find("upserts");
  const auto removes = raw.find("removes");
  if (upserts == raw.end() || !upserts->is_array() || upserts->size() > kMaxItems) return std::nullopt;
  if (removes == raw.end() || !removes->is_array() || removes->size() > kMaxItems) return std::nullopt;
  ParsedBatch parsed;
  if (const auto enabled = raw.find("enabled"); enabled != raw.end()) {
    if (!enabled->is_boolean()) return std::nullopt;
    parsed.batch.enabled = enabled->get<bool>();
  }
  for (const auto& candidate : *upserts) {
    if (auto region = parseRegion(candidate)) parsed.batch.upserts.push_back(std::move(*region));
    else parsed.rejected += 1;
  }
  for (const auto& candidate : *removes) {
    if (isId(candidate)) parsed.batch.removes.push_back(candidate.get<std::string>());
    else parsed.rejected += 1;
  }
  return parsed;
}

std::optional<std::vector<SampleRect>> parseSampleRects(const Json& raw) {
  if (!raw.is_array() || raw.size() > static_cast<size_t>(kMaxSampleRects)) return std::nullopt;
  std::vector<SampleRect> rects;
  for (const auto& item : raw) {
    SampleRect r;
    if (!item.is_object() || !numberIn(item, "x", -kCoordLimit, kCoordLimit, r.x) ||
        !numberIn(item, "y", -kCoordLimit, kCoordLimit, r.y) || !numberIn(item, "width", 0, kCoordLimit, r.width) ||
        !numberIn(item, "height", 0, kCoordLimit, r.height))
      return std::nullopt;
    if (const auto under = item.find("under"); under != item.end()) {
      if (!under->is_string() || under->get_ref<const std::string&>() != "window") return std::nullopt;
      r.underWindow = true;
    }
    rects.push_back(r);
  }
  return rects;
}

const char* levelName(Level level) {
  switch (level) {
    case Level::Regular: return "regular";
    case Level::Clear: return "clear";
    case Level::Tinted: return "tinted";
    case Level::Prominent: return "prominent";
  }
  return "regular";
}

const char* appearanceName(Appearance appearance) {
  return appearance == Appearance::Dark ? "dark" : "light";
}

}  // namespace tentacle::glass
