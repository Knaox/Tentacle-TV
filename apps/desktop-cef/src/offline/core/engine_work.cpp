// UN essai de transfert et sa traduction en statut — `worker.ts`, `engineWork.ts`,
// `engineEnd.ts`, `preparePhase.ts` (sans la finalisation MP4, que le bureau n'a pas).

#include "offline/core/engine_work.h"

#include <cctype>
#include <cstdio>

#include "offline/core/meta.h"
#include "offline/core/queue.h"
#include "offline/core/subs.h"

namespace tentacle::offline {
namespace {

std::string encodeUriComponent(const std::string& s) {
  static const char* hex = "0123456789ABCDEF";
  std::string out;
  for (const unsigned char c : s) {
    if (std::isalnum(c) || std::string("-_.!~*'()").find(static_cast<char>(c)) != std::string::npos) {
      out.push_back(static_cast<char>(c));
    } else {
      out += '%';
      out += hex[c >> 4];
      out += hex[c & 15];
    }
  }
  return out;
}

std::string lightQuery(const FileRow& file) {
  std::string query = "?mediaSourceId=" + file.mediaSourceId + "&preset=" + file.preset.value_or("p720");
  if (file.audioStreamIndex) query += "&audioStreamIndex=" + std::to_string(*file.audioStreamIndex);
  if (file.burnSubtitleIndex) query += "&burnSubtitleIndex=" + std::to_string(*file.burnSubtitleIndex);
  return query;
}

/// Snapshot et sous-titres, best-effort : leur échec n'empêche jamais le média.
Task<void> fetchSidecars(const EngineDeps& deps, Volume volume, FetchBytes fetchBytes, FetchBytes fetchPublic, Creds creds,
                         FileRow file, int64_t nowMs) {
  Database& db = *deps.db;
  if (file.sourcePath) {  // un titre de musique : sa pochette seulement
    try {
      co_await fetchMusicCover(fetchBytes, db, creds.serverUrl, volume, file.itemId, fetchPublic);
    } catch (...) {
    }
    co_return;
  }
  if (!snapshotExists(volume, file.itemId)) {
    if (const auto spec = getSpec(db, file.itemId)) {
      try {
        co_await snapshot(fetchBytes, db, creds.serverUrl, volume, *spec, nowMs);
      } catch (...) {
        // Snapshot manqué : la fiche sera pauvre hors ligne, le film sera là.
      }
    }
  }
  if (file.subtitlesJson) {
    const auto specs = parseSpecs(*file.subtitlesJson);
    if (!specs.empty()) {
      try {
        const auto onUnexpected = deps.onUnexpected;
        const std::string itemId = file.itemId;
        const int64_t fetched = co_await fetchSubtitles(
            fetchBytes, creds.serverUrl, volume, file.itemId, file.mediaSourceId, specs,
            [onUnexpected, itemId](const SubtitleSpec& spec, const std::string& reason) {
              if (onUnexpected) {
                onUnexpected("subs.fetch",
                             itemId + " piste " + std::to_string(spec.index) + " (" + spec.langTag + ") : " + reason);
              }
            });
        setSubtitlesDone(db, file.itemId, file.mediaSourceId, fetched);
      } catch (...) {
      }
    }
  }
}

/// Le média d'ABORD (remis au pilote), les à-côtés PENDANT qu'il avance (`worker.ts`).
Task<TransferEnd> runWorker(const EngineDeps& deps, Creds creds, FileRow file, std::shared_ptr<TransferFlags> flags,
                            WorkerHooks hooks, int64_t nowMs) {
  const Volume volume = deps.volume();
  std::filesystem::path finalPath;
  try {
    finalPath = safeJoin(volume, file.relPath);
  } catch (...) {
    co_return TransferEnd::failed("io", 0);
  }
  std::optional<ServerPrepare> prepare;
  if (file.variant != "original" && !file.sourcePath && deps.serverPrepare) prepare = deps.serverPrepare();
  TransferJob job;
  job.url = mediaUrl(creds.serverUrl, file, prepare);
  job.token = creds.token;
  job.finalPath = finalPath;
  job.variant = file.variant;
  job.expectedSize = file.expectedSize;
  job.serverUrl = creds.serverUrl;
  job.resumable = file.variant == "original" || prepare.has_value();
  if (prepare) job.releaseUrl = creds.serverUrl + "/api/downloads/prepared/" + file.itemId + lightQuery(file);
  const FetchBytes fetchBytes = deps.makeFetcher(creds.token);
  const FetchBytes fetchPublic = deps.makePublicFetcher ? deps.makePublicFetcher() : FetchBytes();
  Started<TransferEnd> media(runTransfer(*deps.driver, volume, job, flags, hooks.onProgress, deps.now,
                                         {hooks.onExpected, hooks.onResponse, deps.onUnexpected}));
  co_await fetchSidecars(deps, volume, fetchBytes, fetchPublic, creds, file, nowMs);
  co_return co_await media;
}

}  // namespace

std::string mediaUrl(const std::string& serverUrl, const FileRow& file, const std::optional<ServerPrepare>& prepare) {
  if (file.sourcePath) return serverUrl + *file.sourcePath;
  if (file.variant == "original") {
    return serverUrl + "/api/downloads/original/" + file.itemId + "?mediaSourceId=" + file.mediaSourceId;
  }
  if (prepare) {
    return serverUrl + "/api/downloads/prepared/" + file.itemId + lightQuery(file) + "&tag=" + encodeUriComponent(prepare->tag);
  }
  return serverUrl + "/api/downloads/light/" + file.itemId + lightQuery(file);
}

Task<Attempt> runAttempt(const EngineDeps& deps, Creds creds, int64_t fileId, std::shared_ptr<TransferFlags> flags,
                         std::function<void()> changed) {
  Database& db = *deps.db;
  const auto file = getFile(db, fileId);
  Attempt attempt{TransferEnd::failed("io", 0), false};
  std::optional<int> lastStatus;
  if (file) {
    // Mutable : le pilote peut annoncer le total en cours de route.
    auto expected = std::make_shared<std::optional<int64_t>>(file->expectedSize);
    WorkerHooks hooks;
    hooks.onProgress = [&deps, &attempt, fileId, expected](int64_t bytes) {
      attempt.moved = true;
      setBytesDone(*deps.db, fileId, bytes, deps.now());
      deps.emit("downloads://progress",
                {{"fileId", fileId}, {"bytesDone", bytes}, {"expectedSize", *expected ? nlohmann::json(**expected) : nlohmann::json()}});
    };
    hooks.onExpected = [&deps, fileId, expected](int64_t total) {
      *expected = total;
      setExpectedSize(*deps.db, fileId, total, deps.now());
    };
    hooks.onResponse = [&deps, &lastStatus, fileId, changed](int status) {
      lastStatus = status;
      // Le transfert commence : la page quitte « Préparation… ».
      const auto current = status < 400 ? getFile(*deps.db, fileId) : std::nullopt;
      if (current && current->phase == std::optional<std::string>(kPreparePhase)) {
        setPhase(*deps.db, fileId, std::nullopt, deps.now());
        changed();
      }
    };
    try {
      attempt.end = co_await runWorker(deps, creds, *file, flags, hooks, deps.now());
    } catch (const std::exception& error) {
      // Une exception levée PARCE QU'ON VIENT D'INTERROMPRE n'est pas une panne.
      if (flags->cancel()) attempt.end = TransferEnd::canceled();
      else if (flags->pause()) attempt.end = TransferEnd::paused(file->bytesDone);
      else {
        if (deps.onUnexpected) deps.onUnexpected("engine.work", error.what());
        attempt.end = TransferEnd::failed("unexpected", file->bytesDone);
      }
    }
  }
  // La phase « préparation » reste si le serveur a dit qu'il préparait (503), tombe sinon.
  const bool preparing = attempt.end.kind == TransferEnd::Kind::Failed && attempt.end.code == "network" && lastStatus == 503;
  if (!preparing) {
    const auto current = getFile(db, fileId);
    if (current && current->phase == std::optional<std::string>(kPreparePhase)) setPhase(db, fileId, std::nullopt, deps.now());
  }
  co_return attempt;
}

}  // namespace tentacle::offline
