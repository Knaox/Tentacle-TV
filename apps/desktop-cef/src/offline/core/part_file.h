#pragma once
// Le `.part` d'un transfert : des écritures POSITIONNELLES — `node/nodePartWriter.ts`.
//
// Chaque bloc s'écrit à son offset plutôt qu'en ajout : une reprise rouvre le fichier sans le
// tronquer et continue exactement où le transfert précédent s'était arrêté. Les échecs lèvent
// `std::filesystem::filesystem_error` (code système : `files::classify` y reconnaît un disque
// plein). Deux implémentations : POSIX (`part_file_posix.cpp`, macOS et Linux) et Windows
// (`src/platform/windows/offline_part_file_windows.cpp`, chemins larges).

#include <cstdint>
#include <filesystem>
#include <memory>

namespace tentacle::offline {

class PartFile {
 public:
  enum class Mode { Truncate, Reuse };  // repartir de zéro | rouvrir pour une reprise
  virtual ~PartFile() = default;
  virtual void write(const void* data, size_t length, int64_t offset) = 0;
  virtual void sync() = 0;
  virtual void close() = 0;

  /// Lève si le fichier ne s'ouvre pas (`Reuse` sur un absent compris, comme `r+`).
  static std::unique_ptr<PartFile> open(const std::filesystem::path& target, Mode mode);
};

}  // namespace tentacle::offline
