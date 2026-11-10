// Le texte des adresses comme JavaScript le traite (voir web_url.h) : URLSearchParams,
// encodeURIComponent, UTF-8 « sans perte », et la collation de localeCompare.

#include <cstdint>
#include <string>
#include <vector>

#include "net/web_url.h"

namespace tentacle::net {
namespace {

int hexValue(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

// Un élément de collation (racine de CLDR, « non-ignorable ») : poids primaire, secondaire
// (accent), tertiaire (casse). primaire 0 = ignorable.
struct Element {
  int primary = 0, secondary = 0, tertiary = 0;
};

// Blancs, ponctuation et symboles dans l'ordre de CLDR, chiffres, puis lettres.
int asciiPrimary(char32_t c) {
  static constexpr std::string_view kOrder =
      "\t\n\v\f\r _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$0123456789abcdefghijklmnopqrstuvwxyz";
  if (c >= 'A' && c <= 'Z') c = c - 'A' + 'a';
  const size_t at = kOrder.find(static_cast<char>(c));
  return at == std::string_view::npos ? 0 : int(at) + 1;
}

// Latin-1 (U+00C0–U+00FF) : la lettre de base et son accent, rangé comme ICU
// (aigu < grave < circonflexe < rond < tréma < tilde < cédille < barre ; eth approché).
void latin1(char32_t c, std::vector<Element>& out) {
  static constexpr std::string_view kBase =   // une lettre par point de code, « * » = à part
      "AAAAAA*CEEEEIIIIDNOOOOO*OUUUUY**aaaaaa*ceeeeiiiidnooooo*ouuuuy*y";
  static constexpr std::string_view kAccent =  // 1 aigu… 8 barre, 9 eth ; 0 rien
      "2136540721352135962136508213510021365407213521359621365082135105";
  const size_t i = c - 0xC0;
  const char base = kBase[i];
  const bool upper = c < 0xE0;
  if (c == 0xC6 || c == 0xE6) {  // Æ æ : « ae »
    out.push_back({asciiPrimary('a'), 0, upper});
    out.push_back({asciiPrimary('e'), 0, upper});
  } else if (c == 0xDF) {  // ß : « ss »
    out.push_back({asciiPrimary('s'), 0, 0});
    out.push_back({asciiPrimary('s'), 0, 0});
  } else if (c == 0xDE || c == 0xFE) {  // Þ þ : après z
    out.push_back({asciiPrimary('z') + 1, 0, upper});
  } else if (base == '*') {  // × ÷ : symboles
    out.push_back({500 + int(c), 0, 0});
  } else {
    out.push_back({asciiPrimary(char32_t(base)), kAccent[i] - '0', upper});
  }
}

std::vector<Element> collationElements(std::string_view utf8) {
  std::vector<Element> out;
  const auto* p = reinterpret_cast<const unsigned char*>(utf8.data());
  for (size_t i = 0; i < utf8.size();) {
    char32_t c = p[i];
    int len = c < 0x80 ? 1 : c < 0xE0 ? 2 : c < 0xF0 ? 3 : 4;
    if (i + len > utf8.size()) len = 1;
    if (len > 1) {
      c &= (0xFF >> (len + 1));
      for (int k = 1; k < len; ++k) c = (c << 6) | (p[i + k] & 0x3F);
    }
    i += len;
    if (c < 0x80) {
      if (const int w = asciiPrimary(c); w != 0) out.push_back({w, 0, c >= 'A' && c <= 'Z'});
    } else if (c >= 0xC0 && c <= 0xFF) {
      latin1(c, out);
    } else {
      out.push_back({1000 + int(c), 0, 0});  // hors Latin-1 : ordre des points de code
    }
  }
  return out;
}

}  // namespace

std::string toLowerAscii(std::string s) {
  for (char& c : s) {
    if (c >= 'A' && c <= 'Z') c = static_cast<char>(c - 'A' + 'a');
  }
  return s;
}

std::string percentDecodeBytes(std::string_view s) {
  std::string out;
  out.reserve(s.size());
  for (size_t i = 0; i < s.size(); ++i) {
    if (s[i] == '%' && i + 2 < s.size() && hexValue(s[i + 1]) >= 0 && hexValue(s[i + 2]) >= 0) {
      out += static_cast<char>(hexValue(s[i + 1]) * 16 + hexValue(s[i + 2]));
      i += 2;
    } else {
      out += s[i];
    }
  }
  return out;
}

std::string sanitizeUtf8(std::string_view bytes) {
  static constexpr char kReplacement[] = "\xEF\xBF\xBD";
  std::string out;
  out.reserve(bytes.size());
  const auto* p = reinterpret_cast<const unsigned char*>(bytes.data());
  const size_t n = bytes.size();
  size_t i = 0;
  while (i < n) {
    const unsigned char c = p[i];
    if (c < 0x80) {
      out += char(c);
      ++i;
      continue;
    }
    int need = 0;
    unsigned char lo = 0x80, hi = 0xBF;
    if (c >= 0xC2 && c <= 0xDF) need = 1;
    else if (c == 0xE0) { need = 2; lo = 0xA0; }
    else if (c >= 0xE1 && c <= 0xEC) need = 2;
    else if (c == 0xED) { need = 2; hi = 0x9F; }
    else if (c >= 0xEE && c <= 0xEF) need = 2;
    else if (c == 0xF0) { need = 3; lo = 0x90; }
    else if (c >= 0xF1 && c <= 0xF3) need = 3;
    else if (c == 0xF4) { need = 3; hi = 0x8F; }
    if (need == 0) {
      out += kReplacement;
      ++i;
      continue;
    }
    // La plus longue sous-partie valide est remplacée par UN seul U+FFFD (WHATWG).
    size_t j = i + 1;
    bool ok = true;
    for (int k = 0; k < need; ++k, ++j) {
      const unsigned char lower = k == 0 ? lo : 0x80, upper = k == 0 ? hi : 0xBF;
      if (j >= n || p[j] < lower || p[j] > upper) {
        ok = false;
        break;
      }
    }
    if (ok) {
      out.append(reinterpret_cast<const char*>(p + i), j - i);
    } else {
      out += kReplacement;
    }
    i = j;
  }
  return out;
}

FormParams parseFormQuery(std::string_view query) {
  FormParams params;
  size_t start = 0;
  while (start <= query.size()) {
    size_t end = query.find('&', start);
    if (end == std::string_view::npos) end = query.size();
    std::string_view seq = query.substr(start, end - start);
    if (!seq.empty()) {
      const size_t eq = seq.find('=');
      std::string name(seq.substr(0, eq)), value;
      if (eq != std::string_view::npos) value = std::string(seq.substr(eq + 1));
      for (char& c : name) if (c == '+') c = ' ';
      for (char& c : value) if (c == '+') c = ' ';
      params.emplace_back(sanitizeUtf8(percentDecodeBytes(name)), sanitizeUtf8(percentDecodeBytes(value)));
    }
    start = end + 1;
  }
  return params;
}

std::optional<std::string> formParam(const FormParams& params, std::string_view name) {
  for (const auto& [k, v] : params) {
    if (k == name) return v;
  }
  return std::nullopt;
}

std::string encodeUriComponent(std::string_view utf8) {
  static constexpr char kHex[] = "0123456789ABCDEF";
  std::string out;
  for (unsigned char c : utf8) {
    const bool keep = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
                      c == '-' || c == '_' || c == '.' || c == '!' || c == '~' || c == '*' ||
                      c == '\'' || c == '(' || c == ')';
    if (keep) {
      out += char(c);
    } else {
      out += '%';
      out += kHex[c >> 4];
      out += kHex[c & 15];
    }
  }
  return out;
}

int localeCompare(std::string_view a, std::string_view b) {
  // Niveau primaire sur toute la chaîne, puis les accents, puis la casse (minuscule d'abord).
  const auto ea = collationElements(a), eb = collationElements(b);
  for (int level = 0; level < 3; ++level) {
    std::vector<int> ka, kb;
    for (const Element& e : ea) ka.push_back(level == 0 ? e.primary : level == 1 ? e.secondary : e.tertiary);
    for (const Element& e : eb) kb.push_back(level == 0 ? e.primary : level == 1 ? e.secondary : e.tertiary);
    if (ka != kb) return ka < kb ? -1 : 1;
  }
  return 0;
}

}  // namespace tentacle::net
