#!/bin/zsh
# reset.sh : relance les deux apps (iPhone : session reposée, artefact SecureStore) et rouvre les profils croisés
cd "$(dirname "$0")/../.."
export WT_BACKEND_PORT=3731 WT_METRO_PORT=8731
npx tsx wt-bench/phones/session.ts ios 2BEC37D0-942E-478B-8C0F-6A7B8E91B515 a "WT banc iPhone (Testeur)" 2>&1 | tail -1
adb -s emulator-5580 shell am force-stop com.tentacletv.mobile; adb -s emulator-5580 shell monkey -p com.tentacletv.mobile -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 10
"$(dirname "$0")/pick.sh" iPhone compat-user2; "$(dirname "$0")/pick.sh" sdk_gphone compat-user
for d in iPhone sdk_gphone; do "$(dirname "$0")/d.sh" $d press-label "Pas maintenant" >/dev/null; done
