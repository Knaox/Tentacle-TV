import android.os.SystemClock;
import android.view.InputDevice;
import android.view.InputEvent;
import android.view.KeyCharacterMap;
import android.view.KeyEvent;
import java.lang.reflect.Method;

/**
 * Une SÉQUENCE de touches à temps précis, en un seul processus — injectée
 * comme le fait la commande `input` (droits du shell). `input keyevent` coûte
 * un lancement de processus par touche (des centaines de millisecondes) : un
 * pas toutes les 400 ms n'y tient pas.
 *
 *   app_process -Djava.class.path=/data/local/tmp/perf-keys.dex /system/bin Keys <pas>…
 *
 * Pas : `tap:<code>` (appui bref, 60 ms), `tap:<code>x<n>@<ms>` (n appuis,
 * un toutes les ms), `hold:<code>:<ms>` (tenue : répétitions après 500 ms,
 * puis toutes les 50 ms, comme Android), `wait:<ms>`.
 */
public class Keys {
  private static Object manager;
  private static Method inject;

  private static void send(KeyEvent event) throws Exception {
    inject.invoke(manager, event, 0);
  }

  private static KeyEvent key(long down, long at, int action, int code, int repeat, int flags) {
    return new KeyEvent(down, at, action, code, repeat, 0, KeyCharacterMap.VIRTUAL_KEYBOARD, 0, flags, InputDevice.SOURCE_KEYBOARD);
  }

  private static void sleepUntil(long at) throws InterruptedException {
    long now = SystemClock.uptimeMillis();
    if (at > now) Thread.sleep(at - now);
  }

  private static void tap(int code) throws Exception {
    long down = SystemClock.uptimeMillis();
    send(key(down, down, KeyEvent.ACTION_DOWN, code, 0, 0));
    sleepUntil(down + 60);
    send(key(down, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, code, 0, 0));
  }

  private static void hold(int code, long duration) throws Exception {
    long down = SystemClock.uptimeMillis();
    send(key(down, down, KeyEvent.ACTION_DOWN, code, 0, 0));
    long end = down + duration;
    long next = down + 500;
    int repeat = 1;
    while (next <= end) {
      sleepUntil(next);
      send(key(down, next, KeyEvent.ACTION_DOWN, code, repeat, repeat == 1 ? KeyEvent.FLAG_LONG_PRESS : 0));
      repeat++;
      next += 50;
    }
    sleepUntil(end);
    send(key(down, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, code, 0, 0));
  }

  public static void main(String[] args) throws Exception {
    // API 34 et plus : InputManagerGlobal (InputManager.getInstance exige un contexte).
    Class<?> managerClass;
    try {
      managerClass = Class.forName("android.hardware.input.InputManagerGlobal");
    } catch (ClassNotFoundException e) {
      managerClass = Class.forName("android.hardware.input.InputManager");
    }
    manager = managerClass.getMethod("getInstance").invoke(null);
    inject = managerClass.getMethod("injectInputEvent", InputEvent.class, int.class);
    for (String step : args) {
      String[] part = step.split(":");
      switch (part[0]) {
        case "wait":
          Thread.sleep(Long.parseLong(part[1]));
          break;
        case "hold":
          hold(Integer.parseInt(part[1]), Long.parseLong(part[2]));
          break;
        case "tap": {
          String[] times = part[1].split("x");
          int code = Integer.parseInt(times[0]);
          if (times.length == 1) {
            tap(code);
            break;
          }
          String[] spec = times[1].split("@");
          int count = Integer.parseInt(spec[0]);
          long every = spec.length > 1 ? Long.parseLong(spec[1]) : 400;
          long start = SystemClock.uptimeMillis();
          for (int i = 0; i < count; i++) {
            sleepUntil(start + i * every);
            tap(code);
          }
          break;
        }
        default:
          throw new IllegalArgumentException("pas inconnu : " + step);
      }
    }
    System.out.println("séquence jouée : " + args.length + " pas");
  }
}
