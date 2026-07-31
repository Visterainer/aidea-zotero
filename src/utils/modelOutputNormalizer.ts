export type ModelStreamEvent =
  | { type: "content"; text: string }
  | {
      type: "reasoning";
      text: string;
      channel?: "summary" | "details";
    }
  | { type: "done"; finishReason?: string };

export type ModelOutputWarning = "unclosed-reasoning-tag" | "reasoning-only";

export type NormalizedModelOutput = {
  text: string;
  filteredReasoningChars: number;
  warnings: ModelOutputWarning[];
};

const REASONING_TAG_NAMES = ["think", "thought"] as const;
const OPEN_TAGS = REASONING_TAG_NAMES.map((name) => `<${name}>`);

function partialTagTailLength(text: string, tags: readonly string[]): number {
  const lower = text.toLowerCase();
  let best = 0;
  for (const tag of tags) {
    const max = Math.min(lower.length, tag.length - 1);
    for (let length = max; length > best; length -= 1) {
      if (tag.startsWith(lower.slice(-length))) {
        best = length;
        break;
      }
    }
  }
  return best;
}

function findFirstOpenTag(
  text: string,
  fromIndex: number,
): { index: number; tagName: string; tagLength: number } | null {
  const lower = text.toLowerCase();
  let match: { index: number; tagName: string; tagLength: number } | null =
    null;
  for (const tagName of REASONING_TAG_NAMES) {
    const tag = `<${tagName}>`;
    const index = lower.indexOf(tag, fromIndex);
    if (index >= 0 && (!match || index < match.index)) {
      match = { index, tagName, tagLength: tag.length };
    }
  }
  return match;
}

/**
 * Stateful model-output boundary.
 *
 * Tag filtering is enabled only when the first non-whitespace output starts
 * with a supported reasoning tag. Once enabled, every supported tagged block
 * is treated as reasoning, including blocks split across arbitrary chunks.
 */
export class ModelOutputStreamNormalizer {
  private mode: "undecided" | "passthrough" | "tagged" = "undecided";
  private buffer = "";
  private activeTagName: string | null = null;
  private visibleText = "";
  private filteredReasoningChars = 0;
  private readonly warnings = new Set<ModelOutputWarning>();

  push(event: ModelStreamEvent): ModelStreamEvent[] {
    if (event.type === "done") return [event];
    if (!event.text) return [];
    if (event.type === "reasoning") {
      this.filteredReasoningChars += event.text.length;
      return [event];
    }

    this.buffer += event.text;
    const emitted: ModelStreamEvent[] = [];
    if (this.mode === "undecided") {
      this.decideMode();
    }
    if (this.mode === "passthrough") {
      this.emitContent(this.buffer, emitted);
      this.buffer = "";
      return emitted;
    }
    if (this.mode === "tagged") {
      this.processTaggedBuffer(emitted, false);
    }
    return emitted;
  }

  finish(finishReason?: string): {
    events: ModelStreamEvent[];
    output: NormalizedModelOutput;
  } {
    const events: ModelStreamEvent[] = [];
    if (this.mode === "undecided") {
      if (!this.buffer.trim()) {
        this.buffer = "";
      }
      this.mode = "passthrough";
    }
    if (this.mode === "passthrough") {
      this.emitContent(this.buffer, events);
      this.buffer = "";
    } else {
      this.processTaggedBuffer(events, true);
      if (this.activeTagName) {
        this.filteredReasoningChars += this.buffer.length;
        if (this.buffer) {
          events.push({
            type: "reasoning",
            text: this.buffer,
            channel: "details",
          });
        }
        this.buffer = "";
        this.warnings.add("unclosed-reasoning-tag");
      } else if (this.buffer) {
        this.emitContent(this.buffer, events);
        this.buffer = "";
      }
    }
    if (!this.visibleText && this.filteredReasoningChars > 0) {
      this.warnings.add("reasoning-only");
    }
    events.push({ type: "done", finishReason });
    return {
      events,
      output: {
        text: this.visibleText,
        filteredReasoningChars: this.filteredReasoningChars,
        warnings: [...this.warnings],
      },
    };
  }

  private decideMode(): void {
    const firstNonWhitespace = this.buffer.search(/\S/);
    if (firstNonWhitespace < 0) return;
    const candidate = this.buffer.slice(firstNonWhitespace).toLowerCase();
    const exactTag = OPEN_TAGS.find((tag) => candidate.startsWith(tag));
    if (exactTag) {
      this.mode = "tagged";
      this.filteredReasoningChars += firstNonWhitespace + exactTag.length;
      this.buffer = this.buffer.slice(firstNonWhitespace + exactTag.length);
      this.activeTagName = exactTag.slice(1, -1);
      return;
    }
    if (OPEN_TAGS.some((tag) => tag.startsWith(candidate))) return;
    this.mode = "passthrough";
  }

  private processTaggedBuffer(
    emitted: ModelStreamEvent[],
    final: boolean,
  ): void {
    while (this.buffer) {
      if (this.activeTagName) {
        const closeTag = `</${this.activeTagName}>`;
        const lower = this.buffer.toLowerCase();
        const closeIndex = lower.indexOf(closeTag);
        if (closeIndex >= 0) {
          const reasoningText = this.buffer.slice(0, closeIndex);
          if (reasoningText) {
            emitted.push({
              type: "reasoning",
              text: reasoningText,
              channel: "details",
            });
          }
          this.filteredReasoningChars += closeIndex + closeTag.length;
          this.buffer = this.buffer.slice(closeIndex + closeTag.length);
          this.activeTagName = null;
          continue;
        }
        if (final) return;
        const tailLength = partialTagTailLength(this.buffer, [closeTag]);
        const reasoningText = this.buffer.slice(
          0,
          this.buffer.length - tailLength,
        );
        if (reasoningText) {
          emitted.push({
            type: "reasoning",
            text: reasoningText,
            channel: "details",
          });
          this.filteredReasoningChars += reasoningText.length;
        }
        this.buffer = this.buffer.slice(this.buffer.length - tailLength);
        return;
      }

      const open = findFirstOpenTag(this.buffer, 0);
      if (open) {
        this.emitContent(this.buffer.slice(0, open.index), emitted);
        this.filteredReasoningChars += open.tagLength;
        this.buffer = this.buffer.slice(open.index + open.tagLength);
        this.activeTagName = open.tagName;
        continue;
      }
      if (final) return;
      const tailLength = partialTagTailLength(this.buffer, OPEN_TAGS);
      this.emitContent(
        this.buffer.slice(0, this.buffer.length - tailLength),
        emitted,
      );
      this.buffer = this.buffer.slice(this.buffer.length - tailLength);
      return;
    }
  }

  private emitContent(text: string, events: ModelStreamEvent[]): void {
    if (!text) return;
    this.visibleText += text;
    events.push({ type: "content", text });
  }
}

export function normalizeModelOutput(text: unknown): NormalizedModelOutput {
  const normalizer = new ModelOutputStreamNormalizer();
  normalizer.push({
    type: "content",
    text:
      typeof text === "string"
        ? text
        : typeof text === "number" || typeof text === "boolean"
          ? String(text)
          : "",
  });
  return normalizer.finish().output;
}
