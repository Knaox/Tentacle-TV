import android.content.ComponentName;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.InputEvent;
import android.view.KeyCharacterMap;
import android.view.KeyEvent;
import java.lang.reflect.Method;
import java.util.List;

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
 *
 * GARDE (incident du 07/10 : des touches parties vers le lanceur ont ouvert
 * les Paramètres d'une Shield, qui a redémarré). Premier argument
 * `expect=<paquet>` : avant CHAQUE appui (et chaque répétition d'une tenue),
 * l'app au premier plan est relue ; si ce n'est pas `<paquet>`, ou si elle ne
 * se lit pas, ARRÊT NET sans envoyer la touche (code de sortie 3). Les
 * touches système (Accueil, Paramètres, Menu, Marche, Veille, Applis
 * récentes) sont refusées d'office, avant le premier pas.
 */
public class Keys {
  private static Object manager;
  private static Method inject;
  private static String expected;
  private static Object tasks;
  private static Method getTasks;

  /** Jamais envoyées : Accueil, Marche, Menu, Paramètres, Veille, Applis récentes. */
  private static final int[] FORBIDDEN = {3, 26, 82, 176, 223, 187};

  /** L'app au premier plan (`getTasks(1)` d'ActivityTaskManager), ou null si illisible. */
  private static String foreground() {
    try {
      Object[] args = new Object[getTasks.getParameterCount()];
      Class<?>[] types = getTasks.getParameterTypes();
      for (int i = 0; i < args.length; i++) args[i] = types[i] == int.class ? (i == 0 ? 1 : 0) : (Object) Boolean.FALSE;
      List<?> list = (List<?>) getTasks.invoke(tasks, args);
      if (list == null || list.isEmpty()) return null;
      ComponentName top = (ComponentName) list.get(0).getClass().getField("topActivity").get(list.get(0));
      return top == null ? null : top.getPackageName();
    } catch (Throwable e) {
      return null;
    }
  }

  private static void guard() {
    if (expected == null) return;
    String top = foreground();
    if (!expected.equals(top)) {
      System.out.println("ARRÊT : premier plan = " + top + ", attendu " + expected + " — aucune touche envoyée");
      System.exit(3);
    }
  }

  /** `KEYS_TRACE=1` : chaque appui envoyé, à l'heure de l'appareil (celle de `logcat`). */
  private static final boolean TRACE = System.getenv("KEYS_TRACE") != null;

  private static void send(KeyEvent event) throws Exception {
    // Un relâchement (UP) suit toujours un appui gardé : jamais une nouvelle touche.
    if (event.getAction() == KeyEvent.ACTION_DOWN) guard();
    inject.invoke(manager, event, 0);
    if (TRACE && event.getAction() == KeyEvent.ACTION_DOWN) {
      System.out.println("appui " + event.getKeyCode() + " à " + new java.text.SimpleDateFormat("HH:mm:ss.SSS").format(new java.util.Date()));
    }
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
    int first = 0;
    if (args.length > 0 && args[0].startsWith("expect=")) {
      expected = args[0].substring("expect=".length());
      tasks = Class.forName("android.app.ActivityTaskManager").getMethod("getService").invoke(null);
      for (Method method : tasks.getClass().getMethods()) {
        if (method.getName().equals("getTasks") && (getTasks == null || method.getParameterCount() > getTasks.getParameterCount())) getTasks = method;
      }
      first = 1;
    }
    for (int i = first; i < args.length; i++) {
      for (int code : FORBIDDEN) {
        if (args[i].matches("(tap|hold):" + code + "\\b.*")) {
          System.out.println("ARRÊT : touche système refusée (" + args[i] + ") — aucune touche envoyée");
          System.exit(4);
        }
      }
    }
    for (int i = first; i < args.length; i++) {
      String step = args[i];
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
          for (int n = 0; n < count; n++) {
            sleepUntil(start + n * every);
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
