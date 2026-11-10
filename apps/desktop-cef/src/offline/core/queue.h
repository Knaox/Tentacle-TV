#pragma once
// La file de transferts (`files`) et ses relances — `core/queue.ts` et `core/retry.ts`.
//
// Statuts : queued → downloading → complete | paused | error | canceled. `paused_by_user`
// distingue une pause EXPLICITE (jamais reprise seule) d'une pause SYSTÈME (coupure réseau,
// redémarrage), qui repart d'elle-même.

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "offline/core/sqlite.h"
#include "offline/core/store.h"

namespace tentacle::offline {

std::optional<FileRow> getFile(Database& db, int64_t fileId);
/// Prochain transfert à lancer, FIFO sur la création.
std::optional<FileRow> nextQueued(Database& db);
void setStatus(Database& db, int64_t fileId, const std::string& status, const std::optional<std::string>& errorCode,
               int64_t nowMs);
void setPausedByUser(Database& db, int64_t fileId, bool byUser);
bool isPausedByUser(Database& db, int64_t fileId);
void setPhase(Database& db, int64_t fileId, const std::optional<std::string>& phase, int64_t nowMs);
/// Taille apprise en cours de route : l'affichage seulement, jamais l'intégrité.
void setExpectedSize(Database& db, int64_t fileId, int64_t bytes, int64_t nowMs);
void setBytesDone(Database& db, int64_t fileId, int64_t bytes, int64_t nowMs);
/// Au démarrage : interrompus et pauses SYSTÈME → `queued` ; pauses UTILISATEUR gardées.
void normalizeOnEngineStart(Database& db, int64_t nowMs);
/// Les seules pauses SYSTÈME (jamais un `downloading` : il serait lancé deux fois).
int64_t requeueSystemPauses(Database& db, int64_t nowMs);
/// Pause SYSTÈME de tout ce qui attend une place.
int64_t suspendQueued(Database& db, int64_t nowMs);
int64_t countQueued(Database& db);
/// Octets restants estimés de ce qui est promis (contrôle d'espace d'une mise en file).
int64_t pendingBytes(Database& db);

// --- Relances (`retry.ts`) ----------------------------------------------------------------

/// Trois essais pour une erreur réparable.
extern const std::vector<int64_t> kRetryDelaysMs;
/// Une COUPURE réseau : sans limite, intervalles qui s'allongent puis plafonnent à 5 min.
extern const std::vector<int64_t> kNetworkRetryDelaysMs;
/// Délai de la tentative `attempt` (0 = la première) ; la dernière marche se répète.
std::optional<int64_t> networkRetryDelay(int64_t attempt, const std::vector<int64_t>& delays = kNetworkRetryDelaysMs,
                                         int64_t immediate = 0);
/// `io`, `finalize`, `unexpected` : ce qui peut guérir seul.
bool retryableCode(const std::string& code);
/// Compte l'échec et programme la relance suivante ; vrai si une relance est programmée.
bool recordFailure(Database& db, int64_t fileId, const std::string& code, const std::vector<int64_t>& delays,
                   int64_t nowMs);
void scheduleNetworkRetry(Database& db, int64_t fileId, std::optional<int64_t> dueAt, int64_t nowMs);
void clearRetry(Database& db, int64_t fileId);
/// Remet en file ce dont l'échéance est atteinte ; rend le nombre de lignes touchées.
int64_t requeueDueRetries(Database& db, int64_t nowMs);
std::optional<int64_t> nextRetryDueAt(Database& db);
int64_t countAwaitingRetry(Database& db);

}  // namespace tentacle::offline
