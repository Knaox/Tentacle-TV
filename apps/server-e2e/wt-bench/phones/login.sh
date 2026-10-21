#!/bin/zsh
# login.sh : app neuve + connexion PAR MOT DE PASSE à l'écran (cookie du compte posé par un serveur d'avant)
# iPhone → compat-user ; Android → compat-user2
D="$(dirname "$0")/d.sh"; U=2BEC37D0-942E-478B-8C0F-6A7B8E91B515; P=com.tentacletv.mobile
xcrun simctl uninstall $U com.tentacle.mobile; xcrun simctl keychain $U reset
xcrun simctl install $U ~/.tentacle-lot-mob/builds/ios/TentacleTV.app; xcrun simctl spawn $U defaults write com.tentacle.mobile RCT_jsLocation localhost:8731
xcrun simctl launch $U com.tentacle.mobile >/dev/null
adb -s emulator-5580 shell pm clear $P >/dev/null; adb -s emulator-5580 shell "run-as $P mkdir -p shared_prefs; run-as $P cp /data/local/tmp/prefs.wtm.xml shared_prefs/${P}_preferences.xml"
adb -s emulator-5580 shell monkey -p $P -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
for dev in iPhone:compat-user sdk_gphone:compat-user2; do
  d=${dev%%:*}; acc=${dev##*:}
  for i in $(seq 1 40); do $D $d texts 2>/dev/null | grep -q "Welcome\|Bienvenue" && break; sleep 3; done
  $D $d press-exact FR >/dev/null; $D $d type "tentacle.example" "http://127.0.0.1:3731" >/dev/null; $D $d press-exact Continuer >/dev/null; sleep 4
  $D $d type "Nom d'utilisateur" "$acc" >/dev/null; $D $d type "Mot de passe" "compat-Jellyfin-2026" >/dev/null; sleep 1; $D $d press-exact "Se connecter"
done
