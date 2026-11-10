#include "offline/core/base64.h"

namespace tentacle::offline::base64 {
namespace {

constexpr char kAlphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

int valueOf(char c) {
  if (c >= 'A' && c <= 'Z') return c - 'A';
  if (c >= 'a' && c <= 'z') return c - 'a' + 26;
  if (c >= '0' && c <= '9') return c - '0' + 52;
  if (c == '+') return 62;
  if (c == '/') return 63;
  return -1;
}

}  // namespace

std::string encode(const std::vector<uint8_t>& bytes) {
  std::string out;
  out.reserve((bytes.size() + 2) / 3 * 4);
  size_t i = 0;
  for (; i + 2 < bytes.size(); i += 3) {
    const uint32_t n = (uint32_t{bytes[i]} << 16) | (uint32_t{bytes[i + 1]} << 8) | bytes[i + 2];
    out.push_back(kAlphabet[(n >> 18) & 63]);
    out.push_back(kAlphabet[(n >> 12) & 63]);
    out.push_back(kAlphabet[(n >> 6) & 63]);
    out.push_back(kAlphabet[n & 63]);
  }
  if (i + 1 == bytes.size()) {
    const uint32_t n = uint32_t{bytes[i]} << 16;
    out.push_back(kAlphabet[(n >> 18) & 63]);
    out.push_back(kAlphabet[(n >> 12) & 63]);
    out += "==";
  } else if (i + 2 == bytes.size()) {
    const uint32_t n = (uint32_t{bytes[i]} << 16) | (uint32_t{bytes[i + 1]} << 8);
    out.push_back(kAlphabet[(n >> 18) & 63]);
    out.push_back(kAlphabet[(n >> 12) & 63]);
    out.push_back(kAlphabet[(n >> 6) & 63]);
    out.push_back('=');
  }
  return out;
}

std::optional<std::vector<uint8_t>> decodeStrict(const std::string& text) {
  if (text.size() % 4 != 0) return std::nullopt;
  // `=` de bourrage : en fin seulement, deux au plus.
  size_t padding = 0;
  while (padding < text.size() && text[text.size() - 1 - padding] == '=') ++padding;
  if (padding > 2) return std::nullopt;
  const size_t body = text.size() - padding;
  std::vector<uint8_t> out;
  out.reserve(body * 3 / 4);
  uint32_t buffer = 0;
  int bits = 0;
  for (size_t i = 0; i < body; ++i) {
    const int v = valueOf(text[i]);
    if (v < 0) return std::nullopt;
    buffer = (buffer << 6) | static_cast<uint32_t>(v);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push_back(static_cast<uint8_t>((buffer >> bits) & 0xff));
    }
  }
  return out;
}

}  // namespace tentacle::offline::base64
