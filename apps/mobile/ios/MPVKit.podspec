# MPVKit — libmpv 0.41 + FFmpeg 8.1 + libass + libplacebo + dav1d pour iOS,
# avec la sortie vidéo `vo=avfoundation` (patch du fork Streamyfin, absent
# d'upstream). SEULE source de l'URL et de la somme de contrôle du binaire :
# le Podfile pointe ici (`pod 'MPVKit', :podspec => 'MPVKit.podspec'`). Hors du
# dossier du module à dessein : l'autolinking Expo y prendrait ce podspec pour
# un pod de développement, qui ne télécharge jamais sa source `:http`.
#
# Variante LGPL construite par `.github/workflows/mpvkit.yml` (run 37645796496,
# 2026-10-07) : mpv -Dgpl=false, FFmpeg sans --enable-gpl ni --enable-nonfree
# (« LGPL version 3 or later »), sans libsmbclient ni LuaJIT. C'est le binaire
# de TestFlight comme de l'App Store — le même. La garde de mobile.yml
# (check-podspec-license.mjs) refuse toute autre source dès le cran test.
# Jusqu'en 1.10.x : binaires GPL du fork (0.41.0-av5), non conformes.
Pod::Spec.new do |s|
  s.name             = 'MPVKit'
  s.version          = '0.41.0-av5-lgpl'
  s.summary          = 'MPVKit LGPL avec la sortie vidéo AVFoundation (fork Streamyfin)'
  s.description      = <<-DESC
    Fork de MPVKit ajoutant vo_avfoundation : rendu dans un AVSampleBufferDisplayLayer,
    image dans l image, VideoToolbox, OSD composite pour les sous-titres, HDR.
  DESC
  s.homepage         = 'https://github.com/streamyfin/MPVKit'
  s.license          = { :type => 'LGPL-3.0-or-later', :text => 'mpv LGPL-2.1-or-later, FFmpeg LGPL-3.0-or-later ; voir apps/mobile/THIRD-PARTY-LICENSES.md.' }
  s.author           = { 'streamyfin' => 'https://github.com/streamyfin' }
  s.source           = {
    :http   => 'https://github.com/Knaox/Tentacle-TV/releases/download/mpvkit-lgpl-0.41.0-av5/MPVKit.xcframework.zip',
    :sha256 => '68ffe2969de9451eec36671f4706fc313f118bfcfa085d175304a8563de1c583'
  }

  s.ios.deployment_target = '15.1'

  # MPVKit isolé : chaque tranche devient un seul objet qui n'exporte que
  # l'API mpv_*. Sans cela, le pod libdav1d 1.2.0 d'expo-image (libavif)
  # l'emportait en partie sur le dav1d 1.5.2 de MPVKit à l'édition de liens,
  # et mpv plantait dès l'ouverture d'un AV1 (mesuré le 2026-10-07). Le texte
  # du script est lu ici, pour une somme de contrôle stable dans Podfile.lock.
  s.prepare_command = "set -- MPVKit.xcframework\n" + File.read(File.join(__dir__, 'MPVKit-isolate.sh'))

  s.static_framework = true
  s.requires_arc = true

  # Le zip s'extrait en MPVKit.xcframework à la racine (slices ios-arm64 et
  # simulateur arm64/x86_64 ; les slices tvOS sont ignorées ici).
  s.vendored_frameworks = 'MPVKit.xcframework'

  s.frameworks = [
    'AVFoundation', 'AudioToolbox', 'CoreAudio', 'CoreVideo', 'CoreFoundation',
    'CoreMedia', 'Metal', 'QuartzCore', 'VideoToolbox'
  ]
  s.libraries = ['bz2', 'iconv', 'expat', 'resolv', 'xml2', 'z', 'c++']

  s.pod_target_xcconfig = {
    'VALID_ARCHS' => 'arm64 x86_64',
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386'
  }
  s.user_target_xcconfig = {
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386'
  }
  # -ObjC : les catégories Objective-C de la bibliothèque statique doivent être
  # liées même si rien ne les référence directement.
  s.xcconfig = { 'OTHER_LDFLAGS' => '$(inherited) -ObjC' }
end
