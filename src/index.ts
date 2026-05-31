import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";

const basicTool = new BasicTool();

// @ts-expect-error - Plugin instance is not typed
const existingAddon = basicTool.getGlobal("Zotero")[config.addonInstance] as
  | {
      hooks?: { onShutdown?: () => void | Promise<void> };
    }
  | undefined;

if (existingAddon?.hooks?.onShutdown) {
  try {
    const shutdownResult = existingAddon.hooks.onShutdown();
    if (
      shutdownResult &&
      typeof (shutdownResult as Promise<void>).catch === "function"
    ) {
      void (shutdownResult as Promise<void>).catch((err) => {
        Zotero.debug?.(`AIdea: previous instance shutdown failed: ${err}`);
      });
    }
  } catch (err) {
    Zotero.debug?.(`AIdea: previous instance shutdown failed: ${err}`);
  }
}

_globalThis.addon = new Addon();
defineGlobal("ztoolkit", () => {
  return _globalThis.addon.data.ztoolkit;
});
// @ts-expect-error - Plugin instance is not typed
Zotero[config.addonInstance] = addon;

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => any): void;
function defineGlobal(name: string, getter?: () => any) {
  Object.defineProperty(_globalThis, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}
