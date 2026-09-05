import { config } from "../../../package.json";

const PENDING_ANNOTATION_TRANSLATION_TTL_MS = 2 * 60 * 1000;
const WRITE_TO_ANNOTATION_PREF = `${config.prefsPrefix}.selectionTranslate.writeToAnnotation`;

type PendingSelectionTranslation = {
  libraryID: number;
  attachmentItemID: number;
  annotationKey?: string;
  selectedText: string;
  translation: string;
  expiresAt: number;
};

export type QueueSelectionTranslationForAnnotationParams = {
  libraryID: number;
  attachmentItemID: number;
  annotationKey?: string;
  selectedText: string;
  translation: string;
};

const pendingSelectionTranslations = new Map<
  string,
  PendingSelectionTranslation
>();
const applyingAnnotationKeys = new Set<string>();

export function bindSelectionTranslationAnnotationOption(
  input: HTMLInputElement,
  target: Omit<
    QueueSelectionTranslationForAnnotationParams,
    "selectedText" | "translation"
  >,
) {
  let current: QueueSelectionTranslationForAnnotationParams | null = null;
  const cancel = () => {
    if (current) cancelSelectionTranslationForAnnotation(current);
  };
  const refresh = () => {
    input.checked = Zotero.Prefs.get(WRITE_TO_ANNOTATION_PREF, true) === true;
    input.disabled = !current;
    if (current && input.checked) {
      queueSelectionTranslationForAnnotation(current);
    } else {
      cancel();
    }
  };
  input.addEventListener("change", () => {
    Zotero.Prefs.set(WRITE_TO_ANNOTATION_PREF, input.checked, true);
    refresh();
  });
  refresh();

  return {
    reset() {
      cancel();
      current = null;
      refresh();
    },
    setTranslation(result: { selectedText: string; translation: string }) {
      cancel();
      current =
        result.selectedText.trim() && result.translation.trim()
          ? { ...target, ...result }
          : null;
      refresh();
    },
  };
}

function normalizePositiveInt(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.floor(number);
}

function normalizeAnnotationKey(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSelectedText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getAnnotationPendingKey(
  libraryID: number,
  annotationKey: string,
): string {
  return `annotation\x00${libraryID}\x00${annotationKey}`;
}

function getSelectionPendingKey(
  libraryID: number,
  attachmentItemID: number,
  selectedText: string,
): string {
  return `selection\x00${libraryID}\x00${attachmentItemID}\x00${selectedText}`;
}

function clearExpiredPendingSelectionTranslations(now: number): void {
  for (const [key, pending] of pendingSelectionTranslations) {
    if (pending.expiresAt <= now) pendingSelectionTranslations.delete(key);
  }
}

export function buildSelectionTranslationAnnotationComment(
  existingComment: string,
  translation: string,
): string {
  const existing = String(existingComment || "").trim();
  const nextTranslation = String(translation || "").trim();
  if (!nextTranslation) return existing;
  if (!existing) return nextTranslation;
  if (
    existing === nextTranslation ||
    existing.endsWith(`\n\n${nextTranslation}`)
  ) {
    return existing;
  }
  return `${existing}\n\n${nextTranslation}`;
}

export function queueSelectionTranslationForAnnotation(
  params: QueueSelectionTranslationForAnnotationParams,
  now: number = Date.now(),
): boolean {
  clearExpiredPendingSelectionTranslations(now);
  const libraryID = normalizePositiveInt(params.libraryID);
  const attachmentItemID = normalizePositiveInt(params.attachmentItemID);
  const annotationKey = normalizeAnnotationKey(params.annotationKey);
  const selectedText = normalizeSelectedText(params.selectedText);
  const translation = String(params.translation || "").trim();
  if (!libraryID || !attachmentItemID || !selectedText || !translation) {
    return false;
  }
  const pendingKey = annotationKey
    ? getAnnotationPendingKey(libraryID, annotationKey)
    : getSelectionPendingKey(libraryID, attachmentItemID, selectedText);
  pendingSelectionTranslations.set(pendingKey, {
    libraryID,
    attachmentItemID,
    annotationKey: annotationKey || undefined,
    selectedText,
    translation,
    expiresAt: now + PENDING_ANNOTATION_TRANSLATION_TTL_MS,
  });
  return true;
}

export function cancelSelectionTranslationForAnnotation(params: {
  libraryID: number;
  annotationKey?: string;
  attachmentItemID?: number;
  selectedText?: string;
}): void {
  const libraryID = normalizePositiveInt(params.libraryID);
  const annotationKey = normalizeAnnotationKey(params.annotationKey);
  if (!libraryID) return;
  if (annotationKey) {
    pendingSelectionTranslations.delete(
      getAnnotationPendingKey(libraryID, annotationKey),
    );
  }
  const attachmentItemID = normalizePositiveInt(params.attachmentItemID);
  const selectedText = normalizeSelectedText(params.selectedText);
  if (attachmentItemID && selectedText) {
    pendingSelectionTranslations.delete(
      getSelectionPendingKey(libraryID, attachmentItemID, selectedText),
    );
  }
}

export function clearPendingSelectionTranslationsForAnnotations(): void {
  pendingSelectionTranslations.clear();
  applyingAnnotationKeys.clear();
}

export async function applyPendingSelectionTranslationToAnnotation(
  item: Zotero.Item | null | undefined,
  now: number = Date.now(),
): Promise<boolean> {
  clearExpiredPendingSelectionTranslations(now);
  if (!item?.isAnnotation?.()) return false;
  const libraryID = normalizePositiveInt(item.libraryID);
  const annotationKey = normalizeAnnotationKey(item.key);
  const attachmentItemID = normalizePositiveInt(item.parentID);
  if (!libraryID || !attachmentItemID) return false;
  const annotationPendingKey = annotationKey
    ? getAnnotationPendingKey(libraryID, annotationKey)
    : "";
  const annotationText = normalizeSelectedText(item.annotationText);
  const selectionPendingKey = annotationText
    ? getSelectionPendingKey(libraryID, attachmentItemID, annotationText)
    : "";
  const pendingKey =
    (annotationPendingKey &&
      pendingSelectionTranslations.has(annotationPendingKey) &&
      annotationPendingKey) ||
    selectionPendingKey;
  const pending = pendingKey
    ? pendingSelectionTranslations.get(pendingKey)
    : undefined;
  if (!pending || pending.expiresAt <= now) return false;
  if (attachmentItemID !== pending.attachmentItemID) {
    return false;
  }
  if (applyingAnnotationKeys.has(pendingKey)) return false;
  if (item.isEditable && !item.isEditable()) {
    pendingSelectionTranslations.delete(pendingKey);
    throw new Error("The created annotation is not editable");
  }

  applyingAnnotationKeys.add(pendingKey);
  try {
    const currentComment = String(item.annotationComment || "");
    const nextComment = buildSelectionTranslationAnnotationComment(
      currentComment,
      pending.translation,
    );
    if (nextComment !== currentComment) {
      item.annotationComment = nextComment;
      await item.saveTx();
    }
    pendingSelectionTranslations.delete(pendingKey);
    ztoolkit.log(
      `LLM: Added selection translation to annotation ${annotationKey || "(pending)"} ` +
        `(attachment=${pending.attachmentItemID}, source=${pending.selectedText.slice(0, 80)})`,
    );
    return true;
  } finally {
    applyingAnnotationKeys.delete(pendingKey);
  }
}
