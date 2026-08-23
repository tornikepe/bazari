import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_VIEWED,
  clearViewed,
  getServerSnapshot,
  getSnapshot,
  recordView,
  subscribe,
} from "@/lib/recently-viewed-store";

/**
 * A browser, enough of one.
 *
 * The unit suite runs in Node, and this store is the only thing in it that
 * touches `window`. Pulling in jsdom to provide two methods would add a
 * dependency and several seconds to every run of 350 tests; the store uses
 * exactly `localStorage` and the `storage` event, so that is what is stood up
 * here — and standing it up by hand keeps the surface it depends on visible.
 */
const storage = new Map<string, string>();

beforeAll(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
        removeItem: (key: string) => void storage.delete(key),
        clear: () => storage.clear(),
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
});

/**
 * The list is small and the rules are few, but every one of them is a bug
 * somebody has shipped: duplicates on a reload, unbounded growth, and a
 * snapshot that returns a fresh array on every call and re-renders for ever.
 */
describe("recently viewed", () => {
  beforeEach(() => {
    storage.clear();
    clearViewed();
  });

  it("keeps the newest first", () => {
    recordView("a");
    recordView("b");
    expect(getSnapshot()).toEqual(["b", "a"]);
  });

  it("moves a revisit to the front rather than repeating it", () => {
    // Opening the same product four times is not four products.
    for (const id of ["a", "b", "a", "a"]) recordView(id);
    expect(getSnapshot()).toEqual(["a", "b"]);
  });

  it("stops growing", () => {
    for (let index = 0; index < MAX_VIEWED + 8; index++) recordView(`p${index}`);
    expect(getSnapshot()).toHaveLength(MAX_VIEWED);
    // And it kept the newest, not the first ones it saw.
    expect(getSnapshot()[0]).toBe(`p${MAX_VIEWED + 7}`);
  });

  it("ignores an empty id", () => {
    recordView("");
    expect(getSnapshot()).toEqual([]);
  });

  it("returns the same array when nothing changed", () => {
    // `useSyncExternalStore` compares by reference: a fresh array every call
    // is an infinite render loop.
    recordView("a");
    const first = getSnapshot();
    recordView("a");
    expect(getSnapshot()).toBe(first);
  });

  it("tells subscribers only when something changed", () => {
    let calls = 0;
    const stop = subscribe(() => (calls += 1));

    recordView("a");
    expect(calls).toBe(1);

    recordView("a");
    expect(calls, "a repeat of the newest product announced a change").toBe(1);

    stop();
  });

  it("renders as empty on the server", () => {
    // There is no browser storage during a server render, and guessing would
    // produce markup the client then has to correct.
    expect(getServerSnapshot()).toEqual([]);
  });

  it("survives rubbish in storage", () => {
    storage.set("bazari.viewed.v1", "{ not json");
    expect(() => getSnapshot()).not.toThrow();
  });
});
