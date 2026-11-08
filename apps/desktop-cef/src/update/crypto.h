#pragma once
// Cryptographie de la mise à jour : signature ed25519 (comme Sparkle « EdDSA ») et
// empreinte SHA-256. Une seule implémentation pour les trois systèmes : libsodium, liée
// en statique (aucune bibliothèque de plus dans le paquet, aucun écart entre OS).

#include <array>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace tentacle::update {

using PublicKey = std::array<uint8_t, 32>;

// Base64 standard (avec ou sans « = »). nullopt si le texte est mal formé.
std::optional<std::vector<uint8_t>> base64Decode(std::string_view text);
std::string base64Encode(const uint8_t* data, size_t size);
std::optional<PublicKey> publicKeyFromBase64(std::string_view text);

// Vrai seulement si `signature` (64 octets) signe exactement `message` avec `key`.
bool verifyEd25519(const PublicKey& key, std::string_view message, const std::vector<uint8_t>& signature);

// Empreinte en flux (téléchargement) ; `hex()` termine le calcul (une seule fois).
class Sha256 {
 public:
  Sha256();
  void update(const void* data, size_t size);
  std::string hex();

 private:
  alignas(64) unsigned char state_[128];  // crypto_hash_sha256_state (104 octets)
};

std::optional<std::string> sha256File(const std::string& path);
bool isSha256Hex(std::string_view text);
// Comparaison sans fuite de temps et insensible à la casse de deux empreintes hexadécimales.
bool sameDigest(std::string_view a, std::string_view b);

}  // namespace tentacle::update
