// La politique du transfert d'un fichier — portage ligne à ligne de `core/transfer.ts`.

#include "offline/core/transfer.h"

#include "offline/core/files.h"

namespace tentacle::offline {
namespace {

constexpr int64_t kPersistEveryBytes = 4 * 1024 * 1024;
constexpr int64_t kPersistEveryMs = 700;

/// Jette un `.part` ; déjà absent ou verrouillé : il sera jeté au prochain passage.
void discard(const std::filesystem::path& part) {
  try {
    files::remove(part);
  } catch (...) {
  }
}

int64_t sizeOr(const std::filesystem::path& part, int64_t fallback) { return files::size(part).value_or(fallback); }

CallbackAwaiter<bool> stopCall(TransferDriver& driver, std::string url, HeaderList headers) {
  return CallbackAwaiter<bool>([&driver, url = std::move(url), headers = std::move(headers)](std::function<void(bool)> done) {
    driver.stopTranscode(url, headers, [done] { done(true); });
  });
}

}  // namespace

Task<TransferEnd> runTransfer(TransferDriver& driver, Volume volume, TransferJob job, std::shared_ptr<TransferFlags> flags,
                              std::function<void(int64_t)> onProgress, std::function<int64_t()> now,
                              TransferHooks hooks) {
  std::filesystem::path part = job.finalPath;
  part += ".part";

  // Le dossier de l'item n'existe pas au premier transfert, et RIEN d'autre ne le crée.
  try {
    files::mkdirp(job.finalPath.parent_path());
  } catch (...) {
    co_return TransferEnd::failed("io", 0);
  }

  // Reprise : l'Original, et la préparation tenue par le serveur. Un transcodage tiré en
  // direct n'est pas rejouable.
  int64_t resumeFrom = 0;
  const bool resumable = job.resumable.value_or(job.variant == "original");
  if (resumable) {
    resumeFrom = sizeOr(part, 0);
    // Le `.part` est DÉJÀ complet (l'Original seul : la taille d'un Allégé n'est qu'une
    // estimation) : on ne retélécharge pas des gigaoctets déjà sur le disque.
    if (job.variant == "original" && job.expectedSize && *job.expectedSize > 0 && resumeFrom == *job.expectedSize) {
      try {
        files::rename(part, job.finalPath);
      } catch (...) {
        co_return TransferEnd::failed("io", resumeFrom);
      }
      co_return TransferEnd::complete(resumeFrom);
    }
  } else {
    discard(part);
  }

  // Session capturée par les en-têtes dès qu'ils arrivent, à défaut celle du client.
  auto session = std::make_shared<std::optional<TranscodeSession>>(job.transcodeSession);
  int64_t lastTotal = 0;
  int64_t lastPersistBytes = resumeFrom;
  int64_t lastPersistAt = now();

  const std::string transcodeBase = job.serverUrl + "/api/jellyfin/Videos/ActiveEncodings";
  // Fin de session serveur, best-effort, à TOUTE sortie : libère ffmpeg côté Jellyfin.
  auto stopTranscode = [&]() -> Task<void> {
    if (!*session) co_return;
    const std::string url = transcodeBase + "?deviceId=" + (*session)->deviceId + "&playSessionId=" + (*session)->playSessionId;
    co_await stopCall(driver, url, {{"X-Emby-Token", job.token}});
  };
  // La préparation du serveur n'est plus utile : arrivée chez nous, ou abandonnée.
  auto release = [&]() -> Task<void> {
    if (!job.releaseUrl || job.releaseUrl->empty()) co_return;
    co_await stopCall(driver, *job.releaseUrl, {{"Authorization", "Bearer " + job.token}});
  };

  TransferRequest request;
  request.url = job.url;
  request.headers = {{"Authorization", "Bearer " + job.token}};
  request.partPath = part;
  request.resumeFrom = resumeFrom;
  request.signal = flags;
  request.onBytes = [&](int64_t total) {
    const int64_t at = now();
    if (total - lastPersistBytes >= kPersistEveryBytes || at - lastPersistAt >= kPersistEveryMs) {
      lastPersistBytes = total;
      lastPersistAt = at;
      if (onProgress) onProgress(total);
    }
  };
  request.onTotal = [&](int64_t totalBytes) {
    // Une seule remontée par valeur.
    if (totalBytes > 0 && totalBytes != lastTotal) {
      lastTotal = totalBytes;
      if (hooks.onExpected) hooks.onExpected(totalBytes);
    }
  };
  request.onHeaders = [&, session](int status, HeaderFn header) {
    if (hooks.onResponse) hooks.onResponse(status);
    const auto play = header("x-tentacle-play-session");
    const auto device = header("x-tentacle-device-id");
    if (play && device) *session = TranscodeSession{*play, *device};
  };

  // Un pilote qui LÈVE (coupé net) : `unexpected` le dit, et les bascules décident d'abord.
  bool threw = false;
  std::string thrown;
  const TransferOutcome outcome = co_await CallbackAwaiter<TransferOutcome>(
      [&driver, &request, &threw, &thrown](std::function<void(TransferOutcome)> done) {
        try {
          driver.download(request, done);
        } catch (const std::exception& e) {
          threw = true;
          thrown = e.what();
          done(TransferOutcome{});
        }
      });
  if (threw) {
    if (flags->cancel()) {
      discard(part);
      co_await stopTranscode();
      co_await release();
      co_return TransferEnd::canceled();
    }
    if (flags->pause()) {
      co_await stopTranscode();
      co_return TransferEnd::paused(sizeOr(part, resumeFrom));
    }
    if (hooks.onUnexpected) hooks.onUnexpected("transfer.download", thrown);
    co_await stopTranscode();
    co_return TransferEnd::failed("unexpected", sizeOr(part, resumeFrom));
  }

  switch (outcome.kind) {
    case TransferOutcome::Kind::Canceled:
      discard(part);
      co_await stopTranscode();
      co_await release();
      co_return TransferEnd::canceled();
    case TransferOutcome::Kind::Paused:
      co_await stopTranscode();
      co_return TransferEnd::paused(sizeOr(part, outcome.bytesKnown));
    case TransferOutcome::Kind::Failed:
      co_await stopTranscode();
      if (outcome.cause == "range-ignored") {
        // Pas pu tronquer : on repart de zéro, en pause SYSTÈME (reprise automatique).
        discard(part);
        co_return TransferEnd::failed("network", 0);
      }
      co_return TransferEnd::failed(outcome.cause, sizeOr(part, outcome.bytesKnown));
    case TransferOutcome::Kind::Done:
      break;
  }

  if (outcome.status >= 400) {
    co_await stopTranscode();
    // 401/403 : jeton expiré pendant le transfert — une pause système qui repart d'elle-même.
    const std::string code = outcome.status == 404 ? "unavailable" : "network";
    const auto wait = outcome.header ? serverWaitMs(outcome.status, outcome.header, now()) : std::nullopt;
    // Le corps d'une erreur n'est pas du média : ce qui dépasse la reprise est jeté.
    if (sizeOr(part, 0) != resumeFrom) {
      discard(part);
      co_return TransferEnd::failed(code, 0, wait);
    }
    co_return TransferEnd::failed(code, resumeFrom, wait);
  }

  co_await stopTranscode();
  const int64_t written = sizeOr(part, 0);
  // Intégrité : l'Original fait EXACTEMENT la taille annoncée, sinon on repart propre.
  if (job.variant == "original" && job.expectedSize && *job.expectedSize > 0 && written != *job.expectedSize) {
    discard(part);
    co_return TransferEnd::failed("integrity", 0);
  }
  if (written == 0) {
    discard(part);
    co_return TransferEnd::failed("integrity", 0);
  }
  try {
    files::rename(part, job.finalPath);
  } catch (...) {
    co_return TransferEnd::failed("io", written);
  }
  co_await release();
  co_return TransferEnd::complete(written);
}

}  // namespace tentacle::offline
