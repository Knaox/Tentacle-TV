import android.os.SystemClock;
import android.view.InputDevice;
import android.view.InputEvent;
import android.view.KeyCharacterMap;
import android.view.KeyEvent;
import java.lang.reflect.Method;

/**
 * Une touche réellement TENUE, injectée comme le fait la commande `input`
 * (droits du shell, `InputManager.injectInputEvent`) : l'enfoncement, puis des
 * répétitions (`repeatCount` 1, 2, 3… — la première après `timeout` ms, puis
 * toutes les `delay` ms, comme `ViewConfiguration`), puis le relâchement.
 * `input keyevent` ne sait pas répéter, et l'émulateur n'a pas de clavier.
 *
 *   app_process -Djava.class.path=/data/local/tmp/hold.dex /system/bin Hold <keycode> <ms> [timeout] [delay]
 */
public class Hold {
  public static void main(String[] args) throws Exception {
    int keyCode = Integer.parseInt(args[0]);
    long duration = Long.parseLong(args[1]);
    long timeout = args.length > 2 ? Long.parseLong(args[2]) : 500;
    long delay = args.length > 3 ? Long.parseLong(args[3]) : 50;
    Class<?> managerClass = Class.forName("android.hardware.input.InputManager");
    Object manager = managerClass.getMethod("getInstance").invoke(null);
    Method inject = managerClass.getMethod("injectInputEvent", InputEvent.class, int.class);
    long down = SystemClock.uptimeMillis();
    KeyEvent pressed = new KeyEvent(down, down, KeyEvent.ACTION_DOWN, keyCode, 0, 0, KeyCharacterMap.VIRTUAL_KEYBOARD, 0, 0, InputDevice.SOURCE_KEYBOARD);
    inject.invoke(manager, pressed, 0);
    long end = down + duration;
    long next = down + timeout;
    int repeat = 1;
    while (next <= end) {
      long now = SystemClock.uptimeMillis();
      if (now < next) {
        Thread.sleep(next - now);
        continue;
      }
      inject.invoke(manager, KeyEvent.changeTimeRepeat(pressed, next, repeat, repeat == 1 ? KeyEvent.FLAG_LONG_PRESS : 0), 0);
      repeat++;
      next += delay;
    }
    long now = SystemClock.uptimeMillis();
    if (end > now) Thread.sleep(end - now);
    long up = SystemClock.uptimeMillis();
    inject.invoke(manager, new KeyEvent(down, up, KeyEvent.ACTION_UP, keyCode, 0, 0, KeyCharacterMap.VIRTUAL_KEYBOARD, 0, 0, InputDevice.SOURCE_KEYBOARD), 0);
    System.out.println("tenue " + keyCode + " : " + (repeat - 1) + " répétitions en " + (up - down) + " ms");
  }
}
