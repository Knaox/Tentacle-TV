#include "update/crypto.h"

#include <sodium.h>

#include <cstdio>
#include <mutex>

namespace tentacle::update {
namespace {

void ensureSodium() {
  static std::once_flag once;
  std::call_once(once, [] {
    if (sodium_init() < 0) std::fprintf(stderr, "[maj] sodium_init a échoué\n");
  });
}

static_assert(sizeof(crypto_hash_sha256_state) <= 128, "état SHA-256 trop grand");

}  // namespace

std::optional<std::vector<uint8_t>> base64Decode(std::string_view text) {
  ensureSodium();
  std::vector<uint8_t> out(text.size() * 3 / 4 + 3);
  size_t len = 0;
  const char* end = nullptr;
  if (sodium_base642bin(out.data(), out.size(), text.data(), text.size(), "\n\r ", &len, &end,
                        sodium_base64_VARIANT_ORIGINAL) == 0 &&
      end == text.data() + text.size()) {
    out.resize(len);
    return out;
  }
  // Sans « = » final (certains outils le retirent).
  if (sodium_base642bin(out.data(), out.size(), text.data(), text.size(), "\n\r ", &len, &end,
                        sodium_base64_VARIANT_ORIGINAL_NO_PADDING) == 0 &&
      end == text.data() + text.size()) {
    out.resize(len);
    return out;
  }
  return std::nullopt;
}

std::string base64Encode(const uint8_t* data, size_t size) {
  ensureSodium();
  std::string out(sodium_base64_ENCODED_LEN(size, sodium_base64_VARIANT_ORIGINAL), '\0');
  sodium_bin2base64(out.data(), out.size(), data, size, sodium_base64_VARIANT_ORIGINAL);
  out.resize(out.size() - 1);  // le zéro final
  return out;
}

std::optional<PublicKey> publicKeyFromBase64(std::string_view text) {
  auto raw = base64Decode(text);
  if (!raw || raw->size() != crypto_sign_PUBLICKEYBYTES) return std::nullopt;
  PublicKey key;
  std::copy(raw->begin(), raw->end(), key.begin());
  return key;
}

bool verifyEd25519(const PublicKey& key, std::string_view message, const std::vector<uint8_t>& signature) {
  ensureSodium();
  if (signature.size() != crypto_sign_BYTES) return false;
  return crypto_sign_verify_detached(signature.data(), reinterpret_cast<const unsigned char*>(message.data()),
                                     message.size(), key.data()) == 0;
}

Sha256::Sha256() {
  ensureSodium();
  crypto_hash_sha256_init(reinterpret_cast<crypto_hash_sha256_state*>(state_));
}

void Sha256::update(const void* data, size_t size) {
  crypto_hash_sha256_update(reinterpret_cast<crypto_hash_sha256_state*>(state_),
                            static_cast<const unsigned char*>(data), size);
}

std::string Sha256::hex() {
  unsigned char digest[crypto_hash_sha256_BYTES];
  crypto_hash_sha256_final(reinterpret_cast<crypto_hash_sha256_state*>(state_), digest);
  char out[crypto_hash_sha256_BYTES * 2 + 1];
  sodium_bin2hex(out, sizeof out, digest, sizeof digest);
  return out;
}

std::optional<std::string> sha256File(const std::string& path) {
  FILE* f = std::fopen(path.c_str(), "rb");
  if (!f) return std::nullopt;
  Sha256 h;
  std::vector<unsigned char> buf(1 << 20);
  size_t n;
  while ((n = std::fread(buf.data(), 1, buf.size(), f)) > 0) h.update(buf.data(), n);
  const bool ok = !std::ferror(f);
  std::fclose(f);
  if (!ok) return std::nullopt;
  return h.hex();
}

bool isSha256Hex(std::string_view text) {
  if (text.size() != 64) return false;
  for (char c : text)
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) return false;
  return true;
}

bool sameDigest(std::string_view a, std::string_view b) {
  if (!isSha256Hex(a) || !isSha256Hex(b)) return false;
  unsigned diff = 0;
  for (size_t i = 0; i < a.size(); ++i) diff |= unsigned((a[i] | 0x20) ^ (b[i] | 0x20));
  return diff == 0;
}

}  // namespace tentacle::update
