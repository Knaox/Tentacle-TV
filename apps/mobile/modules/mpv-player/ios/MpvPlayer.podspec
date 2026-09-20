# Le lecteur avancé de Tentacle TV sur iOS : libmpv (MPVKit) rendu par
# AVFoundation dans un AVSampleBufferDisplayLayer — image dans l'image,
# VideoToolbox, sous-titres composités par mpv.
#
# Le code Swift est dérivé du module `mpv-player` de Streamyfin (MPL-2.0) ;
# chaque fichier dérivé porte son en-tête. Voir apps/mobile/THIRD-PARTY-LICENSES.md.
# Le binaire MPVKit est déclaré par apps/mobile/ios/MPVKit.podspec (URL + SHA-256).
Pod::Spec.new do |s|
  s.name           = 'MpvPlayer'
  s.version        = '1.0.0'
  s.summary        = 'Lecteur avancé de Tentacle TV : libmpv (MPVKit) rendu par AVFoundation'
  s.description    = 'Module Expo : vue vidéo libmpv, pistes, sous-titres, image dans l image, Now Playing.'
  s.author         = 'Tentacle TV'
  s.homepage       = 'https://tentacletv.app'
  s.license        = { :type => 'MPL-2.0' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'MPVKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  # Police latine de repli de libass (Noto Sans, licence OFL 1.1) : copiée dans
  # le bundle principal, d'où `Bundle.main` la relie au dossier de polices mpv.
  s.resources = "Fonts/*.{ttf,otf}"
end
