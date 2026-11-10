#pragma once
// Le système de fichiers, tel que le cœur le voit — le `nodeFiles` d'Electron
// (`node/nodeFiles.ts`). Petites opérations synchrones (JSON, images, sous-titres) ; le
// média passe par le `.part` à écritures positionnelles (`part_file.h`).
//
// Les échecs lèvent `std::filesystem::filesystem_error` (code système + chemin) : c'est ce
// qui permet de dire `EPERM D:\Films` comme Electron (`describe`) et de reconnaître un
// disque plein (`classify`).

#include <cstdint>
#include <exception>
#include <filesystem>
#include <optional>
#include <string>
#include <vector>

namespace tentacle::offline::files {

namespace fs = std::filesystem;

/// Ce que le cœur distingue parmi les échecs : `not-found`, `disk-full`, `other`.
enum class ErrorKind { NotFound, DiskFull, Other };

bool exists(const fs::path& target);
/// Taille d'un FICHIER ordinaire, `nullopt` s'il est absent ou si c'est un dossier.
std::optional<int64_t> size(const fs::path& target);
/// Crée le dossier et ses parents ; déjà là = pas une erreur.
void mkdirp(const fs::path& dir);
void writeBytes(const fs::path& target, const void* data, size_t length);
inline void writeBytes(const fs::path& target, const std::vector<uint8_t>& bytes) {
  writeBytes(target, bytes.data(), bytes.size());
}
void writeText(const fs::path& target, const std::string& text);
/// Lèvent si le fichier est absent.
std::vector<uint8_t> readBytes(const fs::path& target);
std::string readText(const fs::path& target);
/// Supprime un fichier ; absent = pas une erreur.
void remove(const fs::path& target);
/// Supprime un dossier et tout ce qu'il contient ; absent = pas une erreur.
void removeTree(const fs::path& dir);
/// Sur le même volume : c'est ce qui rend la promotion du `.part` atomique.
void rename(const fs::path& from, const fs::path& to);
/// Noms simples (UTF-8) des FICHIERS d'un dossier ; dossier absent → vide.
std::vector<std::string> listFiles(const fs::path& dir);
/// Octets libres du volume portant ce chemin.
int64_t freeSpace(const fs::path& target);

ErrorKind classify(const std::exception& error);
/// La cause en une ligne : le code errno ET le chemin fautif (`EPERM /chemin`), comme Node.
std::string describe(const std::exception& error);
/// Nom errno d'un code système (`ENOSPC`, `EACCES`…), « » s'il n'est pas connu.
std::string errnoName(const std::error_code& code);

/// Lève l'erreur système courante (`errno`) pour ce chemin.
[[noreturn]] void throwErrno(const char* what, const fs::path& target);

}  // namespace tentacle::offline::files
