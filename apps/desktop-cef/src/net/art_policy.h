#pragma once
// Octave — la règle du cache disque des pochettes (bureau), pure et testée : portage de
// `apps/desktop-electron/src/main/octaveArt/artCachePolicy.ts`, à l'identique — mêmes clés,
// donc mêmes noms de fichiers : Electron et CEF relisent le cache l'un de l'autre.
//
//  - La clé d'une pochette : son adresse SANS jeton (`api_key`, `ApiKey`, `x-emby-token`,
//    `token`), paramètres triés — élément, taille et étiquette (`tag`) en font partie : une
//    pochette CHANGÉE dans Jellyfin est une autre entrée. Un jeton renouvelé ne recharge rien.
//  - Rangé PAR IDENTITÉ (serveur + compte) : 4 identités au plus, 200 Mo par identité (les
//    moins récemment servies partent d'abord).
//  - Une adresse sans étiquette se relit au bout de 30 jours.

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace tentacle::net::art {

inline constexpr int64_t kMaxBytesPerOwner = 200ll * 1024 * 1024;
inline constexpr int kMaxOwners = 4;
inline constexpr int64_t kUntaggedMaxAgeMs = 30ll * 24 * 3'600'000;
/// Une pochette n'est pas un média : au-delà, ce n'est pas une image.
inline constexpr int64_t kMaxBytes = 6 * 1024 * 1024;

/// L'adresse peut-elle être demandée par le cache ? http(s) seulement, sans identifiants, bornée.
bool isFetchable(std::string_view upstream);
/// La clé normalisée (sans jeton, paramètres triés) ; nullopt pour une adresse refusée.
std::optional<std::string> key(std::string_view upstream);
/// L'adresse porte-t-elle une étiquette (elle change quand l'image change) ?
bool isTagged(std::string_view key);
/// L'entrée écrite à `writtenAt` (ms) est-elle encore bonne à servir à `now` ?
bool isFresh(std::string_view key, int64_t writtenAt, int64_t now);
/// Le type d'une image d'après ses premiers octets (jamais d'après ce qu'annonce le serveur).
std::optional<std::string> sniffImageType(std::string_view bytes);

struct ArtFile {
  std::string owner;  // le dossier de l'identité
  std::string path;   // rendu tel quel au plan d'éviction
  int64_t size = 0;
  int64_t usedAt = 0;  // dernière fois servi (date de modification, tenue par le cache)
};

/// Ce qu'il faut effacer : les identités au-delà des `maxOwners` plus récentes (celle en
/// cours toujours gardée), puis, par identité, les moins récemment servis au-delà du plafond.
std::vector<std::string> evictionPlan(const std::vector<ArtFile>& files,
                                      const std::optional<std::string>& currentOwner,
                                      int64_t maxBytes = kMaxBytesPerOwner,
                                      int maxOwners = kMaxOwners);

/// Le dossier d'une identité : 24 premiers caractères hex de son SHA-256, « anonyme » sans
/// identité (ou identité vide, comme `owner ? … : "anonyme"` en JavaScript).
std::string ownerDirOf(const std::optional<std::string>& owner);
/// Le nom de fichier d'une clé : 40 premiers caractères hex de son SHA-256.
std::string fileNameOf(std::string_view key);

}  // namespace tentacle::net::art
