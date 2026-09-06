import { assert } from "chai";
import katex from "katex";
import { readFileSync, readdirSync } from "node:fs";
import { format } from "prettier";
import { renderMarkdown, renderMarkdownForNote } from "../src/utils/markdown";

describe("markdown renderer", function () {
  describe("renderMarkdown", function () {
    it("should return empty string for empty input", function () {
      assert.equal(renderMarkdown(""), "");
      assert.equal(renderMarkdown("   "), "");
    });

    it("should render a simple paragraph", function () {
      const html = renderMarkdown("Hello world");
      assert.include(html, "<p>");
      assert.include(html, "Hello world");
    });

    it("should render bold text", function () {
      const html = renderMarkdown("This is **bold** text.");
      assert.include(html, "<strong>bold</strong>");
    });

    it("should render inline code", function () {
      const html = renderMarkdown("Use `console.log()` for debugging.");
      assert.include(html, "<code>console.log()</code>");
    });

    it("should render fenced code blocks", function () {
      const html = renderMarkdown("```python\nprint('hi')\n```");
      assert.include(html, '<pre class="lang-python">');
      assert.include(html, "print(&#039;hi&#039;)");
    });

    it("should render headers", function () {
      const html = renderMarkdown("# Title\n\n## Subtitle\n\n### Section");
      assert.include(html, "<h2>");
      assert.include(html, "<h3>");
      assert.include(html, "<h4>");
    });

    it("should render unordered lists", function () {
      const html = renderMarkdown("- Item 1\n- Item 2\n- Item 3");
      assert.include(html, "<ul>");
      assert.include(html, "<li>");
      assert.include(html, "Item 1");
    });

    it("should render ordered lists", function () {
      const html = renderMarkdown("1. First\n2. Second\n3. Third");
      assert.include(html, "<ol>");
      assert.include(html, "<li>");
    });

    it("should render blockquotes", function () {
      const html = renderMarkdown("> This is a quote");
      assert.include(html, "<blockquote>");
    });

    it("should render horizontal rules", function () {
      const html = renderMarkdown("Above\n\n---\n\nBelow");
      assert.include(html, "<hr/>");
    });

    it("should render tables", function () {
      const md = "| Col A | Col B |\n| --- | --- |\n| 1 | 2 |";
      const html = renderMarkdown(md);
      assert.include(html, "<table>");
      assert.include(html, "<th>");
      assert.include(html, "<td>");
    });

    it("should render links", function () {
      const html = renderMarkdown("[Example](https://example.com)");
      assert.include(html, '<a href="https://example.com"');
      assert.include(html, "Example");
    });

    it("should render markdown images", function () {
      const html = renderMarkdown(
        "Here is one:\n\n![Preview](data:image/png;base64,abc123)",
      );
      assert.include(html, '<img class="llm-markdown-image"');
      assert.include(html, 'src="data:image/png;base64,abc123"');
      assert.include(html, 'alt="Preview"');
    });

    it("should render image titles safely", function () {
      const html = renderMarkdown(
        '![A "quote"](https://example.com/a.png "Example title")',
      );
      assert.include(html, 'alt="A &quot;quote&quot;"');
      assert.include(html, 'title="Example title"');
    });

    it("should escape HTML entities in text", function () {
      const html = renderMarkdown("Use <script> for evil & profit");
      assert.include(html, "&lt;script&gt;");
      assert.include(html, "&amp;");
    });

    it("should handle inline math with $...$", function () {
      const html = renderMarkdown("The formula is $x^2$.");
      // Should contain rendered math (KaTeX span) or a math-inline wrapper
      assert.include(html, "math-inline");
    });

    it("should keep bundled KaTeX CSS aligned with the installed renderer", async function () {
      const html = renderMarkdown("The formula is $x^2$.");
      const css = readFileSync(
        new URL("../addon/content/vendor/katex/katex.min.css", import.meta.url),
        "utf8",
      );

      assert.include(html, "katex-base");
      assert.include(css, ".katex-base");
      assert.include(css, `content: "${katex.version}"`);
      const installedCss = readFileSync(
        new URL("../node_modules/katex/dist/katex.min.css", import.meta.url),
        "utf8",
      );
      assert.equal(
        await format(css, { parser: "css" }),
        await format(installedCss, { parser: "css" }),
      );
    });

    it("should bundle the fonts used by the installed KaTeX renderer", function () {
      const bundledDir = new URL(
        "../addon/content/vendor/katex/fonts/",
        import.meta.url,
      );
      const installedDir = new URL(
        "../node_modules/katex/dist/fonts/",
        import.meta.url,
      );
      const fonts = readdirSync(installedDir);
      assert.isAbove(fonts.length, 0);
      assert.deepEqual(readdirSync(bundledDir).sort(), fonts.sort());
      for (const font of fonts) {
        assert.isTrue(
          readFileSync(new URL(font, bundledDir)).equals(
            readFileSync(new URL(font, installedDir)),
          ),
          font,
        );
      }
    });

    it("should render sized delimiters with braced arguments", function () {
      const html = renderMarkdown("$$\\bigl{(} x + y \\bigr{)}$$");
      assert.include(html, "katex-base");
      assert.notInclude(html, "katex-error");
      assert.notInclude(html, "math-error");
    });

    it("should show malformed environments without dropping following text", function () {
      const html = renderMarkdown(
        "$$\\begin{\\frac{1}{2}} x \\end{array}$$\n\nStill readable.",
      );
      assert.include(html, "katex-error");
      assert.include(html, "Still readable.");
    });

    it("should handle display math with $$...$$", function () {
      const html = renderMarkdown("$$E = mc^2$$");
      assert.include(html, "math-display");
    });

    it("should handle unbalanced delimiters gracefully", function () {
      // Unbalanced backtick should not crash
      const html = renderMarkdown("This has an unmatched ` backtick");
      assert.isString(html);
      assert.include(html, "unmatched");
    });

    it("should handle multiple blocks", function () {
      const md = "# Title\n\nParagraph text.\n\n- List item";
      const html = renderMarkdown(md);
      assert.include(html, "<h2>");
      assert.include(html, "<p>");
      assert.include(html, "<ul>");
    });

    it("should keep | inside inline code as one cell", function () {
      const md = "| regex | note |\n| --- | --- |\n| `a|b` | alternation |";
      const html = renderMarkdown(md);
      assert.include(html, "<code>a|b</code>");
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<td>/g) || []).length, 2);
    });

    it("should keep | inside inline math as one cell", function () {
      const md = "| expr | meaning |\n| --- | --- |\n| $x|y$ | divides |";
      const html = renderMarkdown(md);
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<td>/g) || []).length, 2);
      assert.include(body, "divides");
    });

    it("should keep | inside double quotes as one cell", function () {
      const md = '| word | value |\n| --- | --- |\n| pipe | "|" |';
      const html = renderMarkdown(md);
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<td>/g) || []).length, 2);
      assert.include(body, "&quot;|&quot;");
    });

    it("should keep | inside single quotes as one cell", function () {
      const md = "| word | value |\n| --- | --- |\n| pipe | '|' |";
      const html = renderMarkdown(md);
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<td>/g) || []).length, 2);
      assert.include(body, "&#039;|&#039;");
    });

    it("should ignore word-internal apostrophes when splitting cells", function () {
      const md =
        "| word | meaning |\n| --- | --- |\n| don't | refuse |\n| won't | will not |";
      const html = renderMarkdown(md);
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<tr>/g) || []).length, 2);
      assert.equal((body.match(/<td>/g) || []).length, 4);
    });

    it("should handle mixed delimiter types across rows", function () {
      const md =
        '| kind | example |\n| --- | --- |\n| code | `a|b` |\n| quote | "c|d" |';
      const html = renderMarkdown(md);
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<td>/g) || []).length, 4);
      assert.include(body, "<code>a|b</code>");
      assert.include(body, "&quot;c|d&quot;");
    });

    it("should keep trailing | inside an unpaired opener", function () {
      // Stack-based: an opener without a closer keeps the row inside
      // its context, so pipes after it do not split further cells.
      const md = '| text | note |\n| --- | --- |\n| "open | unclosed |';
      const html = renderMarkdown(md);
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<td>/g) || []).length, 1);
    });

    it("should let outer backticks protect inner quoted |", function () {
      const md =
        '| code | note |\n| --- | --- |\n| `"a|b"` | quote inside code |';
      const html = renderMarkdown(md);
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<td>/g) || []).length, 2);
      assert.include(body, "<code>&quot;a|b&quot;</code>");
    });

    it("should let outer double quotes protect inner apostrophe and |", function () {
      const md = `| phrase | note |\n| --- | --- |\n| "it's|fine" | apostrophe in quote |`;
      const html = renderMarkdown(md);
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<td>/g) || []).length, 2);
      assert.include(body, "it&#039;s|fine");
    });

    it("should let outer single quotes protect inner double-quoted |", function () {
      const md = `| phrase | note |\n| --- | --- |\n| '"a|b"' | double inside single |`;
      const html = renderMarkdown(md);
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<td>/g) || []).length, 2);
      assert.include(body, "&quot;a|b&quot;");
    });

    it("should protect math | alongside code | in the same row", function () {
      const md = "| expr | code |\n| --- | --- |\n| $a|b$ | `c|d` |";
      const html = renderMarkdown(md);
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<td>/g) || []).length, 2);
      assert.include(body, "<code>c|d</code>");
    });

    it("should combine code and quoted | guards in one cell", function () {
      const md = '| kind | sample |\n| --- | --- |\n| mix | `a|b` and "c|d" |';
      const html = renderMarkdown(md);
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<td>/g) || []).length, 2);
      assert.include(body, "<code>a|b</code>");
      assert.include(body, "&quot;c|d&quot;");
    });

    it("should honor the outermost guard with triple nesting", function () {
      const md =
        '| phrase | note |\n| --- | --- |\n| "`$x|y$`" | triple nesting |';
      const html = renderMarkdown(md);
      const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || "";
      assert.equal((body.match(/<td>/g) || []).length, 2);
      // The | inside the outermost "..." pair must not split the row
      assert.include(body, "triple nesting");
    });
  });

  describe("inline math delimiter boundaries", function () {
    for (const [name, render, marker] of [
      ["chat", renderMarkdown, 'class="math-inline"'],
      ["note", renderMarkdownForNote, 'class="math"'],
    ] as const) {
      describe(name, function () {
        const countMath = (html: string) => html.split(marker).length - 1;

        for (const number of [
          "9",
          "0",
          "1",
          "-9",
          "+9",
          "9.5",
          "0.05",
          "1,000",
        ]) {
          it(`should render the number ${number} inside paired dollars`, function () {
            const html = render(`结果为 $${number}$。`);
            assert.equal(countMath(html), 1);
            assert.notInclude(html, "katex-error");
          });
        }

        it("should render the exact previously broken answer", function () {
          const html = render("当 $x=1$、$y=2$ 时，等式左边和右边均为 $9$。");
          assert.equal(countMath(html), 3);
          assert.notInclude(html, "katex-error");
        });

        it("should render explicit parentheses without currency heuristics", function () {
          const html = render("结果 \\( 9 \\)，概率 \\(0\\)，价格 $5。");
          assert.equal(countMath(html), 2);
          assert.include(html, "价格 $5。");
        });

        for (const text of [
          "价格 $9",
          "价格 $5 和 $10",
          "Prices: $20,000 and $30,000.",
          "$9.50 / $10.00",
          "Mean($close, 24)",
          "$ 9 $",
        ]) {
          it(`should keep literal text: ${text}`, function () {
            assert.equal(render(text), `<p>${text}</p>`);
          });
        }

        for (const text of ["结果 $9$，费用 $5", "费用 $5，结果 $9$"]) {
          it(`should render math alongside an unpaired currency sign: ${text}`, function () {
            const html = render(text);
            assert.equal(countMath(html), 1);
            assert.include(html, "费用 $5");
          });
        }

        it("should leave an incomplete streaming formula raw until it closes", function () {
          for (const tail of ["$", "$9", "$x+"]) {
            const html = render(`已有 $1$，下一项 ${tail}`);
            assert.equal(countMath(html), 1);
            assert.include(html, `下一项 ${tail}`);
          }
          assert.equal(countMath(render("已有 $1$，下一项 $9$")), 2);
        });

        it("should honor escaped currency delimiters", function () {
          const html = render("文字 \\$9\\$，金额 \\$5，公式 $9$。");
          assert.equal(countMath(html), 1);
          assert.include(html, "文字 $9$，金额 $5，公式 ");
        });

        it("should preserve escaped dollar signs inside actual math", function () {
          const html = render("金额公式 $\\text{USD }\\$9$，数值 $9$。");
          assert.equal(countMath(html), 2);
          assert.notInclude(html, "katex-error");
        });

        it("should protect code before recognizing math delimiters", function () {
          const html = render("`$9$`、`$x$`、`\\(9\\)`、`$`，实际公式 $9$。");
          assert.include(html, "<code>$9$</code>");
          assert.include(html, "<code>$x$</code>");
          assert.include(html, "<code>\\(9\\)</code>");
          assert.include(html, "<code>$</code>");
          assert.equal(countMath(html), 1);
        });

        it("should keep fenced examples literal", function () {
          const html = render("```text\n$9$ and \\(9\\)\n```");
          assert.equal(countMath(html), 0);
          assert.include(html, "$9$ and \\(9\\)");
        });

        it("should render numeric math in headings, lists, quotes and tables", function () {
          const html = render(
            "# 结果 $9$\n\n- 概率 $0$\n\n> 概率 $1$\n\n| 数值 |\n| --- |\n| $9.5$ |",
          );
          assert.equal(countMath(html), 4);
        });

        it("should preserve display math next to inline math", function () {
          const html = render("内联 $9$，展示 $$9$$，另一种展示 \\[9\\]。");
          assert.equal(countMath(html), name === "chat" ? 1 : 3);
          if (name === "chat") {
            assert.equal(
              html.split('class="math-display-inline"').length - 1,
              2,
            );
          }
          assert.notInclude(html, "katex-error");
        });
      });
    }
  });

  describe("renderMarkdownForNote", function () {
    it("should render display math in note-editor format", function () {
      const html = renderMarkdownForNote("$$x^2 + y^2 = z^2$$");
      assert.include(html, '<pre class="math">$$');
    });

    it("should render inline math in note-editor format", function () {
      const html = renderMarkdownForNote("Inline $x^2$ math.");
      assert.include(html, '<span class="math">$');
    });
  });
});
