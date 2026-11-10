#pragma once
// Sous-titres texte en side-cars (`media/<itemId>/subs/`) — la partie sans réseau de
// `core/subs.ts` (la récupération vit avec le snapshot, `sidecars.h`).

#include <cstdint>
#include <string>
#include <vector>

namespace tentacle::offline {

struct SubtitleSpec {
  int64_t index = 0;   // `MediaStream` côté Jellyfin
  std::string format;  // srt | ass | vtt
  std::string langTag; // étiquette de fichier (« fre-forced »)
};

/// L'étiquette entre dans un NOM DE FICHIER : re-nettoyée (40 caractères `[A-Za-z0-9-]`,
/// minuscules) ; rien ne reste → `und`.
std::string sanitizeTag(const std::string& tag);
/// La liste stockée en base ; un JSON abîmé donne une liste vide.
std::vector<SubtitleSpec> parseSpecs(const std::string& json);
/// `media/<item>/subs/<index>-<étiquette>.<format>`.
std::string subtitleRelPath(const std::string& itemId, const SubtitleSpec& spec);

}  // namespace tentacle::offline
