// Les à-côtés du transfert : bascules observables, en-têtes, `Retry-After` (`retryAfter.ts`),
// total annoncé (`announcedTotal`, `node/streamDriver.ts`).

#include <algorithm>
#include <cctype>
#include <cmath>
#include <ctime>
#include <regex>

#include "offline/core/transfer.h"

namespace tentacle::offline {
namespace {

std::string lower(std::string s) {
  for (auto& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return s;
}

std::string trim(const std::string& s) {
  const auto start = s.find_first_not_of(" \t\r\n");
  if (start == std::string::npos) return "";
  return s.substr(start, s.find_last_not_of(" \t\r\n") - start + 1);
}

/// Une date HTTP (IMF-fixdate, RFC 9110 § 5.6.7), en millisecondes ; rien sinon.
std::optional<int64_t> parseHttpDate(const std::string& raw) {
  static const std::regex imf(R"(^[A-Za-z]{3}, (\d{2}) ([A-Za-z]{3}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$)");
  std::smatch m;
  if (!std::regex_match(raw, m, imf)) return std::nullopt;
  static const char* months[] = {"jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"};
  int month = -1;
  for (int i = 0; i < 12; ++i) {
    if (lower(m[2]) == months[i]) month = i;
  }
  if (month < 0) return std::nullopt;
  // Jours depuis l'époque (algorithme civil, sans fuseau : la date est en GMT).
  int y = std::stoi(m[3]);
  const int mo = month + 1, d = std::stoi(m[1]);
  y -= mo <= 2;
  const int era = (y >= 0 ? y : y - 399) / 400;
  const int yoe = y - era * 400;
  const int doy = (153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const int doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  const int64_t days = static_cast<int64_t>(era) * 146097 + doe - 719468;
  const int64_t seconds = days * 86400 + std::stoi(m[4]) * 3600 + std::stoi(m[5]) * 60 + std::stoi(m[6]);
  return seconds * 1000;
}

}  // namespace

void TransferFlags::setCancel(bool v) {
  cancel_ = v;
  notify();
}

void TransferFlags::setPause(bool v) {
  pause_ = v;
  notify();
}

std::function<void()> TransferFlags::subscribe(std::function<void()> listener) {
  const int id = next_++;
  listeners_[id] = std::move(listener);
  return [this, id] { listeners_.erase(id); };
}

void TransferFlags::notify() {
  const auto copy = listeners_;  // un écouteur peut se désabonner pendant l'appel
  for (const auto& [id, listener] : copy) listener();
}

HeaderFn headerLookup(HeaderList headers) {
  return [headers = std::move(headers)](const std::string& name) -> std::optional<std::string> {
    const std::string wanted = lower(name);
    for (const auto& [key, value] : headers) {
      if (lower(key) == wanted) return value;
    }
    return std::nullopt;
  };
}

std::optional<int64_t> serverWaitMs(int status, const HeaderFn& header, int64_t nowMs) {
  constexpr int64_t kMin = 1000, kMax = 6LL * 60 * 60 * 1000;
  if (status != 503) return std::nullopt;
  const auto value = header("retry-after");
  if (!value) return std::nullopt;
  const std::string raw = trim(*value);
  if (raw.empty()) return std::nullopt;
  double ms = 0;
  if (std::all_of(raw.begin(), raw.end(), [](unsigned char c) { return std::isdigit(c) != 0; })) {
    ms = std::stod(raw) * 1000;
  } else {
    const auto at = parseHttpDate(raw);
    if (!at) return std::nullopt;
    ms = static_cast<double>(*at - nowMs);
  }
  return static_cast<int64_t>(std::min(std::max(ms, static_cast<double>(kMin)), static_cast<double>(kMax)));
}

std::optional<int64_t> announcedTotal(int status, const HeaderFn& header, int64_t from) {
  if (status == 206) {
    static const std::regex range(R"(/(\d+)\s*$)");
    std::smatch m;
    const std::string value = header("content-range").value_or("");
    if (std::regex_search(value, m, range)) return std::stoll(m[1]);
  }
  const auto length = header("content-length");
  if (!length) return std::nullopt;
  try {
    size_t used = 0;
    const std::string trimmed = trim(*length);
    const long long n = std::stoll(trimmed, &used);
    if (used != trimmed.size() || n <= 0) return std::nullopt;
    return from + n;
  } catch (...) {
    return std::nullopt;
  }
}

}  // namespace tentacle::offline
