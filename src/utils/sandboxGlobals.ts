/**
 * Zotero runs plugin code in a sandbox that only receives a short list of
 * web globals (fetch, URL, TextEncoder, crypto, timers, ...). Everything
 * else that code tends to assume, such as AbortController or Event, exists
 * only on windows, and using it bare throws a ReferenceError that Node-based
 * unit tests cannot see.
 *
 * The names below are resolved from the main window on first use and exposed
 * to the whole bundle from `src/index.ts`. Add a name here before using a
 * new window-only global; `test/sandboxGlobals.test.ts` fails otherwise.
 */
export const WINDOW_ONLY_GLOBALS = [
  "AbortController",
  "AbortSignal",
  "CustomEvent",
  "DOMException",
  "Event",
  "FormData",
  "Headers",
  "console",
  "performance",
  "queueMicrotask",
  "structuredClone",
] as const;

/**
 * Define lazy getters for the window-only globals on the plugin scope.
 * A name the scope already has (a newer Zotero may add it) is left alone.
 */
export function installWindowGlobals(
  scope: object,
  resolve: (name: string) => unknown,
  names: readonly string[] = WINDOW_ONLY_GLOBALS,
): void {
  for (const name of names) {
    if (name in scope) continue;
    try {
      Object.defineProperty(scope, name, {
        configurable: true,
        get: () => resolve(name),
      });
    } catch {
      // A scope that refuses the definition keeps its own behaviour.
    }
  }
}
