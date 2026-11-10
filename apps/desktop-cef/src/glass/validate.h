#pragma once
// La validation d'un lot de verre, côté natif — `validate.ts` d'Electron (ses schémas zod),
// à l'identique : mêmes bornes, mêmes champs requis, champs inconnus ignorés.
//
// La page n'est jamais crue sur parole : un nombre démesuré passé à `setFrame:` peut faire
// lever AppKit, et une exception Objective-C tue le processus.
//
// Région par région : une région invalide est écartée, les autres passent. Un lot rejeté en
// bloc laisserait aussi passer à la trappe les RETRAITS qu'il portait, et le verre d'un
// panneau fermé resterait à l'écran.

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <nlohmann/json.hpp>

#include "glass/protocol.h"

namespace tentacle::glass {

struct ParsedBatch {
  Batch batch;
  /// Régions et identifiants écartés — journalisés par l'appelant, jamais muets.
  int rejected = 0;
};

/// Le lot, nettoyé ; nullopt si sa forme même est fausse.
std::optional<ParsedBatch> parseBatch(const nlohmann::json& raw);

/// Les rectangles de `sample`, aux seuls champs du protocole ; nullopt si leur forme est fausse.
std::optional<std::vector<SampleRect>> parseSampleRects(const nlohmann::json& raw);

/// `#RRGGBB` ou `#RRGGBBAA` — la forme que le verre natif sait convertir.
bool isTint(std::string_view text);

/// Longueur d'une chaîne UTF-8 comptée comme JavaScript (unités UTF-16) — celle de zod.
size_t utf16Length(std::string_view utf8);

}  // namespace tentacle::glass
