import { assert } from "chai";
import { DatabaseSync } from "node:sqlite";
import { renderMarkdown } from "../src/utils/markdown";
import { fileUrlToPath, toFileUrl } from "../src/utils/pathFileUrl";
import { isRetryableTransientError } from "../src/utils/transientRetry";
import {
  citationMarkdown,
  citationSourceUrl,
} from "../src/modules/contextPanel/citations";
import {
  buildDocumentContext,
  createDocumentTextContext,
  tokenizeText,
} from "../src/modules/contextPanel/document/retrieval";
import { buildDeterministicSectionPlan } from "../src/modules/contextPanel/document/sectionRouting";
import { resolveEpubReference } from "../src/modules/contextPanel/document/epub/packageReader";
import {
  API_ENDPOINT,
  RESPONSES_ENDPOINT,
  resolveEndpoint,
} from "../src/utils/apiHelpers";
import { migrateRemovedGeminiOAuth } from "../src/utils/oauthMigrations";
import {
  createQueuedStreamingPatch,
  findAssistantBubbleByMessageId,
} from "../src/modules/contextPanel/streamingUpdate";
import {
  isScrollUpdateSuspended,
  resumeScrollUpdates,
  suspendScrollUpdates,
} from "../src/modules/contextPanel/chatScroll";
import {
  disposePanelHostRuntime,
  getPanelDisposeSignal,
} from "../src/modules/contextPanel/heightSync";

describe("audit regressions", function () {
  describe("transient retry status precedence", function () {
    it("does not retry a definite client error whose body mentions a timeout", function () {
      for (const message of [
        "400 Bad Request - unknown parameter: timeout",
        "401 Unauthorized - connection reset by peer",
        "404 Not Found - <html>gateway timed out</html>",
      ]) {
        assert.isFalse(isRetryableTransientError(new Error(message)), message);
      }
    });

    it("still retries transient statuses and statusless network errors", function () {
      assert.isTrue(
        isRetryableTransientError(new Error("503 Service Unavailable")),
      );
      assert.isTrue(isRetryableTransientError(new Error("connection reset")));
    });
  });

  describe("file URL escaping", function () {
    it("round-trips paths containing # and ?", function () {
      for (const path of ["/data/Zotero#lab/a?b.pdf", "D:/Zotero#lab/x.pdf"]) {
        const url = toFileUrl(path) as string;
        assert.notInclude(url, "#");
        assert.notInclude(url, "?");
        assert.equal(fileUrlToPath(url), path);
      }
    });
  });

  describe("markdown rendering of untrusted model output", function () {
    it("does not turn unsafe URL schemes into links", function () {
      for (const url of [
        "javascript:alert(1)",
        "JaVaScRiPt:alert(1)",
        "file:///etc/passwd",
        "data:text/html,<b>x</b>",
        "chrome://browser/content/browser.xhtml",
      ]) {
        const html = renderMarkdown(`[click](${url})`);
        assert.notInclude(html, "<a ", url);
      }
    });

    it("keeps ordinary links working", function () {
      for (const url of [
        "https://example.com/a?b=1",
        "mailto:someone@example.com",
        "zotero://select/library/items/ABCD1234",
        "aidea-cite:3",
      ]) {
        assert.include(renderMarkdown(`[link](${url})`), "<a href=", url);
      }
    });

    it("only renders images from allowed sources", function () {
      assert.notInclude(
        renderMarkdown("![x](javascript:alert(1))"),
        "<img",
        "javascript image",
      );
      assert.notInclude(
        renderMarkdown("![x](data:text/html;base64,AAAA)"),
        "<img",
        "non-image data URL",
      );
      assert.include(
        renderMarkdown("![x](data:image/png;base64,AAAA)"),
        "<img",
        "image data URL",
      );
    });

    it("blocks KaTeX commands that load resources or restyle the page", function () {
      const html = renderMarkdown(
        "$\\href{javascript:alert(1)}{x}$ " +
          "$\\includegraphics{https://example.com/p.png}$ " +
          "$\\htmlStyle{position:fixed;inset:0}{y}$",
      );
      assert.notInclude(html, 'href="javascript:');
      assert.notInclude(html, "<img");
      // The TeX source is still echoed in the MathML annotation; what matters
      // is that it never becomes an applied style.
      assert.notMatch(html, /style="[^"]*position:\s*fixed/);
    });

    it("still allows KaTeX web links", function () {
      assert.include(
        renderMarkdown("$\\href{https://example.com}{x}$"),
        'href="https://example.com"',
      );
    });

    it("keeps attribute markup intact when alt text contains math", function () {
      const html = renderMarkdown("![$x$](https://example.com/a.png)");
      assert.include(html, 'alt="$x$"');
      assert.notInclude(html, 'alt="<span');
    });

    it("does not let same-line display math swallow the rest of the answer", function () {
      const html = renderMarkdown(
        "$$ a = b $$.\n\nNext paragraph here.\n\n- item one",
      );
      assert.include(html, "Next paragraph here.");
      assert.include(html, "<li>item one</li>");
      assert.include(html, "katex");

      const bracket = renderMarkdown("\\[ a = b \\], so:\n\nAfter the math.");
      assert.include(bracket, "<p>After the math.</p>");
    });

    it("still renders fenced and single-line display math as blocks", function () {
      for (const md of ["$$\na = b\n$$\n\nAfter", "$$ a = b $$\n\nAfter"]) {
        const html = renderMarkdown(md);
        assert.include(html, 'class="math-display"', md);
        assert.include(html, "After", md);
      }
    });

    it("prevents placeholder re-expansion attribute breakout and blocks file/svg images", function () {
      const breakout = renderMarkdown(
        "![a](https://example.com/1.png) ![@@PROTECTED0@@](https://example.com/2.png)",
      );
      assert.include(breakout, 'alt="@@PROTECTED0@@"');
      assert.equal((breakout.match(/<img /g) || []).length, 2);
      assert.notInclude(renderMarkdown("![x](file:///etc/passwd)"), "<img");
      assert.notInclude(
        renderMarkdown("![x](data:image/svg+xml,<svg/>)"),
        "<img",
      );
    });

    it("preserves prior blocks during unclosed streaming code fences and supports c++/c# tags", function () {
      const streaming = renderMarkdown(
        "# Heading\n\nBody text.\n\n```c++\nint main() {",
      );
      assert.include(streaming, "<h2>Heading</h2>");
      assert.include(streaming, "<p>Body text.</p>");
      assert.include(streaming, 'class="lang-c++"');
      assert.include(streaming, "int main() {");
      assert.notInclude(streaming, "<code>++");
    });

    it("does not mangle italics inside link URLs", function () {
      const html = renderMarkdown(
        "[docs](https://example.com/a_b_c) and [star](https://example.com/*x*)",
      );
      assert.include(html, 'href="https://example.com/a_b_c"');
      assert.include(html, 'href="https://example.com/*x*"');
      assert.notInclude(html, "<em>x</em>");
    });
  });

  describe("EPUB CFI citations and reference resolution", function () {
    it("escapes parentheses in exported EPUB CFI citation URLs for Markdown", function () {
      const ref = {
        id: "e1",
        itemId: 10,
        itemKey: "ABCD1234",
        libraryId: 1,
        title: "Book",
        kind: "epub" as const,
        text: "excerpt",
        locator: {
          kind: "epub-location" as const,
          cfi: "epubcfi(/6/2!/4/2/1:0)",
          locationLabel: "Ch 1",
        },
      };
      const url = citationSourceUrl(ref) || "";
      assert.notInclude(url, "(");
      assert.notInclude(url, ")");
      const html = renderMarkdown(
        citationMarkdown("See [[cite:e1]].", [ref], true),
      );
      assert.include(html, `href="${url}"`);
      assert.notInclude(html, "</a>)");
    });

    it("rejects scheme-relative EPUB references and preserves #/? in baseHref", function () {
      assert.isNull(
        resolveEpubReference("OEBPS/nav.xhtml", "//evil.test/x.xhtml"),
      );
      const resolved = resolveEpubReference(
        "OEBPS/dir#1/nav?v=2.xhtml",
        "ch1.xhtml#s1",
      );
      assert.deepEqual(resolved, {
        href: "OEBPS/dir#1/ch1.xhtml",
        fragment: "s1",
      });
    });
  });

  describe("BM25 retrieval and section routing", function () {
    it("does not poison BM25 scores on Object.prototype keys like constructor", async function () {
      const globals = globalThis as any;
      const origToolkit = globals.ztoolkit;
      globals.ztoolkit = { log: () => undefined };
      try {
        const ctx = createDocumentTextContext({
          title: "Types",
          text: "First section about sorting.\n\nSecond section defines a type constructor and valueOf conversion.",
        });
        ctx.embeddingFailed = true;
        const out = await buildDocumentContext(
          ctx,
          "How does the type constructor work?",
          false,
          undefined,
          { forceRetrieval: true },
        );
        assert.include(out, "constructor");
      } finally {
        globals.ztoolkit = origToolkit;
      }
    });

    it("tokenizes non-Latin scripts and accented Latin words", function () {
      assert.isAbove(tokenizeText("یادگیری عمیق شبکه‌های عصبی").length, 0);
      assert.isAbove(tokenizeText("الذكاء الاصطناعي وتعلم الآلة").length, 0);
      assert.isAbove(tokenizeText("нейронная сеть обучение").length, 0);
      assert.isAbove(tokenizeText("कृत्रिम बुद्धिमत्ता मॉडल").length, 0);
      assert.include(tokenizeText("La méthode de Schrödinger"), "methode");
      assert.include(tokenizeText("La méthode de Schrödinger"), "schrodinger");
    });

    it("does not hijack section routing via Roman numeral substrings inside words", function () {
      const catalog = {
        cards: [
          {
            id: "s4",
            label: "IV",
            path: ["IV"],
            summary: "",
            terms: [],
            role: "content" as const,
            confidence: "authoritative" as const,
            segmentIds: ["s4"],
          },
          {
            id: "s6",
            label: "VI",
            path: ["VI"],
            summary: "",
            terms: [],
            role: "content" as const,
            confidence: "authoritative" as const,
            segmentIds: ["s6"],
          },
        ],
      };
      assert.isNull(
        buildDeterministicSectionPlan(
          catalog,
          "What evidence supports the derivative?",
        ),
      );
    });
  });

  describe("Windows UNC file URLs, endpoint resolution and migrations", function () {
    it("round-trips Windows UNC paths cleanly", function () {
      const url = toFileUrl("\\\\fileserver\\papers\\a.pdf");
      assert.equal(url, "file://fileserver/papers/a.pdf");
      assert.equal(fileUrlToPath(url), "//fileserver/papers/a.pdf");
    });

    it("preserves query strings and handles /embeddings -> /responses in resolveEndpoint", function () {
      assert.equal(
        resolveEndpoint(
          "https://azure.test/openai/deployments/gpt4/chat/completions?api-version=2024-06-01",
          API_ENDPOINT,
        ),
        "https://azure.test/openai/deployments/gpt4/chat/completions?api-version=2024-06-01",
      );
      assert.equal(
        resolveEndpoint(
          "https://api.test/v1/embeddings///",
          RESPONSES_ENDPOINT,
        ),
        "https://api.test/v1/responses",
      );
    });

    it("does not wipe a user custom provider named Gemini after initial migration", function () {
      const globals = globalThis as any;
      const origZotero = globals.Zotero;
      const prefs = new Map<string, unknown>();
      globals.Zotero = {
        Prefs: {
          get: (k: string) => prefs.get(k),
          set: (k: string, v: unknown) => prefs.set(k, v),
        },
      };
      try {
        migrateRemovedGeminiOAuth();
        prefs.set("extensions.zotero.aidea.lastUsedModelProvider", "Gemini");
        assert.isFalse(migrateRemovedGeminiOAuth());
        assert.equal(
          prefs.get("extensions.zotero.aidea.lastUsedModelProvider"),
          "Gemini",
        );
      } finally {
        globals.Zotero = origZotero;
      }
    });
  });

  describe("rebound paper conversation keys across restart and delete", function () {
    it("reloads rebound paper keys when no pending transfers exist and forgets them on delete", async function () {
      const globals = globalThis as any;
      const origZotero = globals.Zotero;
      const origToolkit = globals.ztoolkit;
      const db = new DatabaseSync(":memory:");
      db.exec(`
        CREATE TABLE zotero_ai_chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_key INTEGER, parent_id INTEGER, active_child_id INTEGER, branch_index INTEGER DEFAULT 0, role TEXT, text TEXT, timestamp INTEGER);
        CREATE TABLE zotero_ai_chat_tree_state (conversation_key INTEGER PRIMARY KEY, active_root_id INTEGER, active_leaf_id INTEGER);
        CREATE TABLE zotero_ai_global_conversations (conversation_key INTEGER PRIMARY KEY, library_id INTEGER, created_at INTEGER, title TEXT, is_pinned INTEGER DEFAULT 0);
        CREATE TABLE zotero_ai_paper_conversations (conversation_key INTEGER PRIMARY KEY, parent_item_id INTEGER, created_at INTEGER, title TEXT, is_pinned INTEGER DEFAULT 0);
        CREATE TABLE zotero_ai_transfer_sources (conversation_key INTEGER PRIMARY KEY, source_json TEXT NOT NULL);
      `);
      db.prepare(
        "INSERT INTO zotero_ai_paper_conversations (conversation_key, parent_item_id, created_at) VALUES (?, ?, ?)",
      ).run(2_000_000_005, 42, 1000);

      globals.ztoolkit = { log: () => undefined };
      globals.Zotero = {
        Prefs: { get: () => "", set: () => undefined },
        DB: {
          async queryAsync(sql: string, args: any[] = []) {
            const stmt = db.prepare(sql);
            return stmt.columns().length
              ? stmt.all(...args)
              : (stmt.run(...args), []);
          },
          async valueQueryAsync(sql: string, args: any[] = []) {
            const row = db.prepare(sql).get(...args);
            return row ? Object.values(row)[0] : false;
          },
          async executeTransaction<T>(fn: () => Promise<T>): Promise<T> {
            return fn();
          },
        },
      };
      try {
        const {
          clearReboundPaperKeys,
          isGlobalChatKey,
          reconcileTransferredConversations,
        } = await import("../src/utils/chatTransfer");
        const { deletePaperConversation } =
          await import("../src/utils/chatStore");
        clearReboundPaperKeys();
        await reconcileTransferredConversations();
        assert.isFalse(isGlobalChatKey(2_000_000_005));
        await deletePaperConversation(2_000_000_005);
        assert.isTrue(isGlobalChatKey(2_000_000_005));
      } finally {
        db.close();
        globals.Zotero = origZotero;
        globals.ztoolkit = origToolkit;
      }
    });
  });

  describe("streaming patch cancel, scroll ref-counting and panel dispose signal", function () {
    it("cancels queued streaming patches before they fire", async function () {
      let calls = 0;
      const queue = createQueuedStreamingPatch(() => {
        calls += 1;
      }, 20);
      queue();
      queue.cancel();
      await new Promise((r) => setTimeout(r, 40));
      assert.equal(calls, 0);
    });

    it("falls back to active streaming bubble when messageId is undefined", function () {
      const bubble = {
        classList: { contains: (c: string) => c === "streaming" },
        querySelector: () => null,
      } as unknown as HTMLDivElement;
      const chatBox = {
        querySelectorAll: () => [{ querySelector: () => bubble }],
      } as unknown as HTMLDivElement;
      assert.strictEqual(
        findAssistantBubbleByMessageId(chatBox, undefined),
        bubble,
      );
    });

    it("ref-counts nested scroll suspensions", function () {
      suspendScrollUpdates();
      suspendScrollUpdates();
      assert.isTrue(isScrollUpdateSuspended());
      resumeScrollUpdates();
      assert.isTrue(isScrollUpdateSuspended());
      resumeScrollUpdates();
      assert.isFalse(isScrollUpdateSuspended());
    });

    it("aborts panel dispose signal during disposePanelHostRuntime", function () {
      const host = {
        dataset: {},
        closest: () => host,
        querySelector: () => null,
      } as unknown as Element;
      const signal = getPanelDisposeSignal(host);
      assert.isDefined(signal);
      assert.isFalse(signal!.aborted);
      disposePanelHostRuntime(host);
      assert.isTrue(signal!.aborted);
    });
  });
});
