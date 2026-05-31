import { saveAuthorProfileNote } from "./cache";
import { generateAuthorProfileMarkdown } from "./generator";
import { getAuthorProfileCopy } from "./i18n";
import { resolveAuthorProfileInput } from "./resolver";
import type { AuthorProfileProgressCallback } from "./types";
import { getAuthorProfileLanguage } from "./utils";

export async function generateAuthorProfileForItem(
  item: Zotero.Item,
  progress?: AuthorProfileProgressCallback,
  signal?: AbortSignal,
): Promise<"created" | "updated"> {
  const copy = getAuthorProfileCopy(getAuthorProfileLanguage());
  const input = await resolveAuthorProfileInput(item, progress, signal);
  const result = await generateAuthorProfileMarkdown(
    item,
    input,
    progress,
    signal,
  );
  progress?.({
    stage: "note",
    message: copy.stageNote,
    fraction: 0.94,
  });
  const status = await saveAuthorProfileNote(item, result);
  progress?.({
    stage: "done",
    message: status === "created" ? copy.doneCreated : copy.doneUpdated,
    fraction: 1,
  });
  return status;
}
