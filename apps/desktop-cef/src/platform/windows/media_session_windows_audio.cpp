// Couture Windows de « À l'écoute » : le nom des sessions audio de Tentacle dans le mélangeur
// de volume (`set_audio_session_name`, ce que faisait `smtc.rs` de la coquille Tauri).
//
// Une session WASAPI naît quand un flux s'ouvre (mpv, le moteur d'Octave) : la page rappelle
// donc ce nom à chaque reprise de lecture, et 1,5 s après. Seules les sessions de CE
// processus sont touchées (`GetProcessId`) ; celles d'un processus audio de Chromium, s'il
// en lance un, ne le sont pas.
//
// Toutes les sorties ACTIVES, pas seulement celle par défaut : un lecteur réglé sur une
// sortie précise (casque, HDMI) y ouvre sa session.

#include "platform/windows/media_session_windows.h"

#include <audiopolicy.h>
#include <mmdeviceapi.h>

namespace tentacle::media_session::win {
namespace {

int renameOnDevice(IMMDevice* device, const std::wstring& name, DWORD pid) {
  ComPtr<IAudioSessionManager2> manager;
  if (FAILED(device->Activate(__uuidof(IAudioSessionManager2), CLSCTX_ALL, nullptr,
                              reinterpret_cast<void**>(manager.GetAddressOf()))))
    return 0;
  ComPtr<IAudioSessionEnumerator> sessions;
  int count = 0;
  if (FAILED(manager->GetSessionEnumerator(&sessions)) || FAILED(sessions->GetCount(&count))) return 0;
  int renamed = 0;
  for (int i = 0; i < count; ++i) {
    ComPtr<IAudioSessionControl> control;
    ComPtr<IAudioSessionControl2> control2;
    if (FAILED(sessions->GetSession(i, &control)) || FAILED(control.As(&control2))) continue;
    // S_OK seulement : AUDCLNT_S_NO_SINGLE_PROCESS (session partagée entre processus) n'est pas à nous.
    DWORD owner = 0;
    if (control2->GetProcessId(&owner) != S_OK || owner != pid) continue;
    if (SUCCEEDED(control2->SetDisplayName(name.c_str(), nullptr))) ++renamed;
  }
  return renamed;
}

}  // namespace

int renameProcessAudioSessions(const std::wstring& name) {
  ComPtr<IMMDeviceEnumerator> devices;
  if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_INPROC_SERVER, __uuidof(IMMDeviceEnumerator),
                              reinterpret_cast<void**>(devices.GetAddressOf()))))
    return 0;
  ComPtr<IMMDeviceCollection> outputs;
  UINT count = 0;
  if (FAILED(devices->EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE, &outputs)) || FAILED(outputs->GetCount(&count)))
    return 0;
  const DWORD pid = GetCurrentProcessId();
  int renamed = 0;
  for (UINT i = 0; i < count; ++i) {
    ComPtr<IMMDevice> device;
    if (SUCCEEDED(outputs->Item(i, &device))) renamed += renameOnDevice(device.Get(), name, pid);
  }
  return renamed;
}

}  // namespace tentacle::media_session::win
