Pod::Spec.new do |s|
  s.name           = 'OfflineStorage'
  s.version        = '1.0.0'
  s.summary        = 'Exclusion de la sauvegarde iCloud pour les titres hors ligne de Tentacle TV'
  s.description    = 'Pose l attribut isExcludedFromBackup sur le dossier des titres hors ligne.'
  s.author         = 'Tentacle TV'
  s.homepage       = 'https://tentacletv.app'
  s.license        = { :type => 'AGPL-3.0-or-later' }
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # La Live Activity des transferts : ActivityKit n'existe qu'à partir d'iOS
  # 16.1 — lié FAIBLEMENT, l'application démarre toujours sur iOS 15.
  s.ios.weak_frameworks = 'ActivityKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
