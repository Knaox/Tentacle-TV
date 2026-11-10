// `.part` Windows : `CreateFileW` (chemin LARGE : un « C:\Users\Josée » passe) + `WriteFile`
// à un offset (OVERLAPPED) + `FlushFileBuffers`. Axe horsligne — `src/offline/core/part_file.h`.

#include <windows.h>

#include <system_error>

#include "offline/core/part_file.h"

namespace tentacle::offline {
namespace {

[[noreturn]] void fail(const char* what, const std::filesystem::path& target) {
  const DWORD error = GetLastError();
  // Disque plein : la condition générique ENOSPC, que `files::classify` reconnaît sur les trois OS.
  if (error == ERROR_DISK_FULL || error == ERROR_HANDLE_DISK_FULL) {
    throw std::filesystem::filesystem_error(what, target, std::make_error_code(std::errc::no_space_on_device));
  }
  throw std::filesystem::filesystem_error(what, target, std::error_code(static_cast<int>(error), std::system_category()));
}

class WindowsPartFile final : public PartFile {
 public:
  WindowsPartFile(HANDLE handle, std::filesystem::path target) : handle_(handle), target_(std::move(target)) {}
  ~WindowsPartFile() override { close(); }

  void write(const void* data, size_t length, int64_t offset) override {
    const auto* bytes = static_cast<const char*>(data);
    while (length > 0) {
      OVERLAPPED at{};
      at.Offset = static_cast<DWORD>(static_cast<uint64_t>(offset) & 0xffffffffULL);
      at.OffsetHigh = static_cast<DWORD>(static_cast<uint64_t>(offset) >> 32);
      const DWORD chunk = static_cast<DWORD>(length > 0x40000000 ? 0x40000000 : length);
      DWORD written = 0;
      if (!WriteFile(handle_, bytes, chunk, &written, &at)) fail("WriteFile", target_);
      if (written == 0) {  // réussite sans un octet : jamais attendu, mais la boucle tournerait
        SetLastError(ERROR_WRITE_FAULT);
        fail("WriteFile", target_);
      }
      bytes += written;
      length -= written;
      offset += written;
    }
  }

  void sync() override {
    if (!FlushFileBuffers(handle_)) fail("FlushFileBuffers", target_);
  }

  void close() override {
    if (handle_ == INVALID_HANDLE_VALUE) return;
    CloseHandle(handle_);
    handle_ = INVALID_HANDLE_VALUE;
  }

 private:
  HANDLE handle_;
  std::filesystem::path target_;
};

}  // namespace

std::unique_ptr<PartFile> PartFile::open(const std::filesystem::path& target, Mode mode) {
  // Partage total, comme Node (libuv ouvre avec les trois) : le lecteur lit un média pendant
  // qu'il s'écrit, une reprise peut rouvrir le `.part` avant que l'ancien descripteur soit
  // fermé, et le renommage final passe même s'il reste ouvert ailleurs.
  const DWORD share = FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE;
  const HANDLE handle = CreateFileW(target.c_str(), GENERIC_WRITE, share, nullptr,
                                    mode == Mode::Truncate ? CREATE_ALWAYS : OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (handle == INVALID_HANDLE_VALUE) fail("CreateFileW", target);
  return std::make_unique<WindowsPartFile>(handle, target);
}

}  // namespace tentacle::offline
