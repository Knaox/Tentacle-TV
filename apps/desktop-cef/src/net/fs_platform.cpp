// Dates de fichiers et numéro de processus — l'aiguillage d'OS du module réseau.

#include "net/fs_platform.h"

#include <chrono>

#if defined(_WIN32)
#include <process.h>
#include <windows.h>
#else
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

namespace tentacle::net {
namespace fs = std::filesystem;

int64_t nowMs() {
  return std::chrono::duration_cast<std::chrono::milliseconds>(
             std::chrono::system_clock::now().time_since_epoch()).count();
}

#if defined(_WIN32)

namespace {
// FILETIME : centaines de ns depuis 1601 ; l'époque Unix est 11 644 473 600 s plus tard.
int64_t fileTimeToMs(const FILETIME& t) {
  const uint64_t v = (uint64_t(t.dwHighDateTime) << 32) | t.dwLowDateTime;
  return int64_t(v / 10'000) - 11'644'473'600'000ll;
}
FILETIME msToFileTime(int64_t ms) {
  const uint64_t v = uint64_t(ms + 11'644'473'600'000ll) * 10'000;
  return FILETIME{DWORD(v & 0xffffffff), DWORD(v >> 32)};
}
}  // namespace

std::optional<int64_t> birthTimeMs(const fs::path& file) {
  WIN32_FILE_ATTRIBUTE_DATA d;
  if (!GetFileAttributesExW(file.c_str(), GetFileExInfoStandard, &d)) return std::nullopt;
  return fileTimeToMs(d.ftCreationTime);
}

std::optional<int64_t> modifiedTimeMs(const fs::path& file) {
  WIN32_FILE_ATTRIBUTE_DATA d;
  if (!GetFileAttributesExW(file.c_str(), GetFileExInfoStandard, &d)) return std::nullopt;
  return fileTimeToMs(d.ftLastWriteTime);
}

bool setModifiedTimeMs(const fs::path& file, int64_t ms) {
  HANDLE h = CreateFileW(file.c_str(), FILE_WRITE_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                         nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, nullptr);
  if (h == INVALID_HANDLE_VALUE) return false;
  const FILETIME t = msToFileTime(ms);
  const BOOL ok = SetFileTime(h, nullptr, &t, &t);  // accès ET modification, comme `utimes`
  CloseHandle(h);
  return ok != 0;
}

int currentPid() { return _getpid(); }

#else

namespace {
int64_t toMs(const timespec& t) { return int64_t(t.tv_sec) * 1000 + t.tv_nsec / 1'000'000; }
}  // namespace

std::optional<int64_t> birthTimeMs(const fs::path& file) {
#if defined(__APPLE__)
  struct stat st;
  if (::stat(file.c_str(), &st) != 0) return std::nullopt;
  return toMs(st.st_birthtimespec);
#elif defined(STATX_BTIME)
  struct statx sx;
  if (::statx(AT_FDCWD, file.c_str(), 0, STATX_BTIME, &sx) != 0 || !(sx.stx_mask & STATX_BTIME)) {
    return std::nullopt;
  }
  return int64_t(sx.stx_btime.tv_sec) * 1000 + sx.stx_btime.tv_nsec / 1'000'000;
#else
  return std::nullopt;
#endif
}

std::optional<int64_t> modifiedTimeMs(const fs::path& file) {
  struct stat st;
  if (::stat(file.c_str(), &st) != 0) return std::nullopt;
#if defined(__APPLE__)
  return toMs(st.st_mtimespec);
#else
  return toMs(st.st_mtim);
#endif
}

bool setModifiedTimeMs(const fs::path& file, int64_t ms) {
  timespec t[2];
  t[0].tv_sec = t[1].tv_sec = time_t(ms / 1000);
  t[0].tv_nsec = t[1].tv_nsec = long((ms % 1000) * 1'000'000);
  return ::utimensat(AT_FDCWD, file.c_str(), t, 0) == 0;  // accès ET modification
}

int currentPid() { return int(::getpid()); }

#endif

}  // namespace tentacle::net
