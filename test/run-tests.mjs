// ============================================================================
// Gemini AI Translator - unit tests for the shared core (no build, no deps).
// Run with:  node test/run-tests.mjs
//
// shared.js is an IIFE that attaches GTShared to `self`. We load it inside a
// VM context with light stubs for the browser/extension globals it touches.
// ============================================================================
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(here, "..", "src", "shared", "shared.js"), "utf8");

const store = {};
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  matchMedia: () => ({ matches: false }),
  chrome: {
    storage: {
      local: {
        get: (keys, cb) => cb(store),
        set: (items, cb) => { Object.assign(store, items); if (cb) cb(); }
      }
    }
  }
};
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const S = sandbox.GTShared;

let passed = 0;
let failed = 0;
function ok(name, cond) {
  if (cond) { passed += 1; }
  else { failed += 1; console.error("  ✗ " + name); }
}

// -- renderRichText ----------------------------------------------------------
ok("bold -> <strong>", S.renderRichText("**hi**").includes("<strong>hi</strong>"));
ok("inline code -> <code>", /<code[^>]*>x<\/code>/.test(S.renderRichText("`x`")));
ok("escapes html", (() => {
  const out = S.renderRichText("<script>alert(1)</script>");
  return out.includes("&lt;script&gt;") && !out.includes("<script>");
})());
ok("bullet list", (() => {
  const out = S.renderRichText("- a\n- b");
  return out.includes("<ul") && (out.match(/<li/g) || []).length === 2;
})());
ok("numbered list", (() => {
  const out = S.renderRichText("1. a\n2. b");
  return out.includes("<ol") && (out.match(/<li/g) || []).length === 2;
})());
ok("empty -> empty", S.renderRichText("   ") === "");
ok("safe http link", (() => {
  const out = S.renderRichText("see [docs](https://example.com/x)");
  return out.includes('href="https://example.com/x"') &&
    out.includes(">docs</a>") && out.includes('rel="noopener noreferrer"');
})());
ok("ignores non-http link", (() => {
  const out = S.renderRichText("[x](javascript:alert(1))");
  return !out.includes("<a ");
})());

// -- text helpers ------------------------------------------------------------
ok("isSingleWord true", S.isSingleWord("hello") === true);
ok("isSingleWord false (space)", S.isSingleWord("hello world") === false);
ok("isSingleWord false (empty)", S.isSingleWord("") === false);
ok("dir rtl", S.detectTextDirection("سلام") === "rtl");
ok("dir ltr", S.detectTextDirection("hello") === "ltr");
ok("escapeHtml quotes", S.escapeHtml("\"a\"") === "&quot;a&quot;");
ok("sanitize strips fences", S.sanitizeModelOutput("```\nfoo\n```", "translate") === "foo");
ok("sanitize keeps structure in dictionary", S.sanitizeModelOutput("word (w)\n- x", "dictionary").includes("- x"));

// -- theme -------------------------------------------------------------------
ok("theme light", S.resolveTheme("light") === "light");
ok("theme dark", S.resolveTheme("dark") === "dark");
ok("theme auto -> dark (no matchMedia match)", S.resolveTheme("auto") === "dark");

// -- cache key ---------------------------------------------------------------
const kA = S.buildCacheKey({ mode: "translate", targetLang: "fa", text: "hi" });
const kB = S.buildCacheKey({ mode: "translate", targetLang: "fa", text: "hi" });
const kC = S.buildCacheKey({ mode: "translate", targetLang: "fa", text: "bye" });
ok("cache key stable", kA === kB);
ok("cache key varies by text", kA !== kC);

// -- searchHistory -----------------------------------------------------------
const hist = [
  { source: "cat", result: "گربه", mode: "translate", targetLang: "fa" },
  { source: "dog", result: "سگ", mode: "dictionary", targetLang: "fa" }
];
ok("search by query", S.searchHistory(hist, { query: "cat" }).length === 1);
ok("search by mode", S.searchHistory(hist, { mode: "dictionary" }).length === 1);
ok("search no filter", S.searchHistory(hist, {}).length === 2);

// -- buildSystemPrompt -------------------------------------------------------
const prompt = S.buildSystemPrompt({
  mode: "translate", targetLang: "fa",
  glossary: [{ source: "K8s", target: "کوبرنتیز" }], text: "deploy K8s now"
});
ok("prompt names target language", prompt.includes("Persian"));
ok("prompt injects matching glossary term", prompt.includes("کوبرنتیز"));
const promptNoGloss = S.buildSystemPrompt({
  mode: "translate", targetLang: "en",
  glossary: [{ source: "K8s", target: "کوبرنتیز" }], text: "hello world"
});
ok("prompt omits non-matching glossary term", !promptNoGloss.includes("کوبرنتیز"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
