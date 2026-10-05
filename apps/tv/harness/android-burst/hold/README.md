# hold — une touche réellement tenue, sur un appareil sans clavier

`input keyevent` ne répète jamais une touche, et l'AVD Android TV n'a pas de
périphérique qui déclare les flèches (ni la console de l'émulateur ni
`sendevent` ne peuvent les tenir). `Hold.java` injecte, comme la commande
`input` (droits du shell), l'enfoncement, des répétitions (`repeatCount` 1, 2…
— la 1re après 500 ms, puis toutes les 50 ms) et le relâchement.

```bash
SDK=~/Library/Android/sdk; JAR=$(ls -d $SDK/platforms/android-3*/android.jar | tail -1)
javac -source 1.8 -target 1.8 -cp "$JAR" -d out Hold.java
$SDK/build-tools/36.1.0/d8 --output out --lib "$JAR" out/Hold.class
adb push out/classes.dex /data/local/tmp/hold.dex
adb shell CLASSPATH=/data/local/tmp/hold.dex app_process /system/bin Hold 20 4000
```

`burst.mjs` s'en sert dès que `hold.dex` est sur l'appareil.
