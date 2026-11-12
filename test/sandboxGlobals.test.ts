import { assert } from "chai";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  installWindowGlobals,
  WINDOW_ONLY_GLOBALS,
} from "../src/utils/sandboxGlobals";

/**
 * Web globals that exist in Node and on windows but not in Zotero's plugin
 * sandbox. `document` and `window` are left out: they are common local
 * names, and code reaches them through a window object anyway.
 */
const NOT_IN_PLUGIN_SANDBOX = [
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
  "BroadcastChannel",
  "EventSource",
  "Image",
  "IntersectionObserver",
  "MutationObserver",
  "ReadableStream",
  "Request",
  "ResizeObserver",
  "TextDecoderStream",
  "WebSocket",
  "cancelAnimationFrame",
  "getComputedStyle",
  "localStorage",
  "navigator",
  "requestAnimationFrame",
  "sessionStorage",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.ts$/.test(name) && !/\.d\.ts$/.test(name) ? [path] : [];
  });
}

describe("plugin sandbox globals", function () {
  it("resolves window-only globals lazily and keeps existing ones", function () {
    const scope: Record<string, unknown> = { Event: "own" };
    const asked: string[] = [];
    installWindowGlobals(scope, (name) => {
      asked.push(name);
      return `window.${name}`;
    });
    assert.deepEqual(asked, []);
    assert.equal(scope.AbortController, "window.AbortController");
    assert.equal(scope.Event, "own");
    assert.deepEqual(asked, ["AbortController"]);
  });

  it("provides every window-only global the source uses bare", function () {
    const provided = new Set<string>(WINDOW_ONLY_GLOBALS);
    const names = NOT_IN_PLUGIN_SANDBOX.join("|");
    // `new Name(`, `Name.member` or `Name(`, not reached through an object
    // (`win.Name`) and not merely named in a type or a `typeof` test.
    const use = new RegExp(
      `(?<![.\\w$"'\`])(?<!typeof\\s)(?:new\\s+)?(${names})(?=\\s*[.(])`,
      "g",
    );
    const missing: string[] = [];
    for (const file of sourceFiles("src")) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        const code = line.replace(/\/\/.*$/, "");
        if (/^\s*(\*|\/\*)/.test(code)) return;
        for (const match of code.matchAll(use)) {
          // `typeof Name !== "undefined" && Name.x` is a guarded use.
          const guarded = new RegExp(`typeof\\s+${match[1]}\\b`).test(
            `${lines[index - 1] || ""}\n${line}`,
          );
          if (!provided.has(match[1]) && !guarded) {
            missing.push(`${file}:${index + 1} ${match[1]}`);
          }
        }
      });
    }
    assert.deepEqual(
      missing,
      [],
      "Take these from a window object, or add them to WINDOW_ONLY_GLOBALS",
    );
  });
});
