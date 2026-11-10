#pragma once
// Lectures composées pour l'interface — `core/listing.ts` : la liste des titres gardés d'un
// compte (`DownloadEntry` de la page), l'état d'un item pour le badge de fiche, et la
// bascule « supprimer après visionnage », portée par le CLAIM (donc par compte).

#include <string>

#include <nlohmann/json.hpp>

#include "offline/core/sqlite.h"

namespace tentacle::offline {

using Json = nlohmann::json;

/// Les films et épisodes (jamais la musique : Octave a sa liste), plus récents d'abord.
Json listForUser(Database& db, const std::string& userId);
/// Le fichier complet en priorité, sinon le transfert le plus récent ; `null` sans claim.
Json stateForItem(Database& db, const std::string& userId, const std::string& itemId);
/// OFF remet tout à zéro ; ON rebase une échéance posée, ou planifie depuis maintenant un
/// item DÉJÀ vu — jamais de suppression immédiate pour une case cochée après coup.
void setAutoDelete(Database& db, const std::string& userId, int64_t fileId, bool enabled, int64_t delayMinutes,
                   int64_t nowMs);

}  // namespace tentacle::offline
