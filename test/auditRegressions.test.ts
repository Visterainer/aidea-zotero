import { assert } from "chai";
import { renderMarkdown } from "../src/utils/markdown";
import { fileUrlToPath, toFileUrl } from "../src/utils/pathFileUrl";
import { isRetryableTransientError } from "../src/utils/transientRetry";

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
  });
});
