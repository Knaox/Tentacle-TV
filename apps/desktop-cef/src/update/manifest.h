#pragma once
// Le manifeste de mise à jour et son enveloppe signée. Format complet : docs/MISE-A-JOUR.md.
//
// Enveloppe (ce que sert le serveur, un seul fichier : pas de course entre deux fetch) :
//   { "format": 1, "keyId": "tentacle-2026", "manifest": "<texte JSON>", "signature": "<base64>" }
// La signature ed25519 porte sur les OCTETS UTF-8 du champ `manifest`, tels quels. Le
// manifeste signé donne l'URL et le SHA-256 de chaque archive : l'archive est authentifiée
// par son empreinte (comme `sparkle:edSignature`, mais une signature pour tout le flux).

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "update/crypto.h"
#include "update/version.h"

namespace tentacle::update {

enum class Severity { Minor, Major, Critical };
const char* severityName(Severity s);

struct Localized {
  std::string fr, en;
  bool empty() const { return fr.empty() && en.empty(); }
};

struct Asset {
  std::string url;
  std::string sha256;  // hexadécimal, 64 caractères
  uint64_t size = 0;   // octets (0 : inconnu)
};

struct Manifest {
  Version version;
  std::string channel;                // « stable », « beta »…
  Severity severity = Severity::Minor;
  std::optional<Version> minVersion;  // en dessous : mise à jour obligatoire
  // Dernière version « majeure » publiée jusqu'à `version` comprise : un appareil resté
  // avant elle traverse une majeure même si `version` n'est qu'une mineure.
  std::optional<Version> majorSince;
  Localized notes;                    // les nouveautés (lignes « • … »)
  Localized reason;                   // obligatoire : pourquoi on ne peut pas continuer
  std::string notesUrl;               // la page des nouveautés
  int64_t issuedAt = 0;               // secondes Unix : refus d'un manifeste plus ancien
  std::map<std::string, Asset> assets;  // « macos-arm64 », « linux-x86_64-appimage »…
};

struct TrustedKey {
  std::string id;
  PublicKey key;
};

// Vérifie l'enveloppe et rend le texte du manifeste. Échec → nullopt et `*error`.
std::optional<std::string> openEnvelope(std::string_view envelope, const std::vector<TrustedKey>& keys,
                                        std::string* error);
std::optional<Manifest> parseManifest(std::string_view json, std::string* error);

// Une URL d'archive acceptable : https, ou http vers la boucle locale (banc seulement).
bool acceptableUrl(std::string_view url, bool allowLoopbackHttp);
bool isLoopbackUrl(std::string_view url);

}  // namespace tentacle::update
