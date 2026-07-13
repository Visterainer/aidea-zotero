export type SelectionTranslatePopupStream = {
  readonly hasContent: boolean;
  push: (delta: string) => void;
  invalidate: () => void;
};

export function createSelectionTranslatePopupStream(params: {
  scheduleFrame: (callback: () => void) => void;
  render: (text: string) => void;
}): SelectionTranslatePopupStream {
  let accumulatedText = "";
  let frameScheduled = false;
  let active = true;
  let revision = 0;

  return {
    get hasContent() {
      return Boolean(accumulatedText.trim());
    },

    push(delta: string) {
      if (!active || !delta) return;
      accumulatedText += delta;
      if (frameScheduled) return;

      frameScheduled = true;
      const scheduledRevision = revision;
      params.scheduleFrame(() => {
        frameScheduled = false;
        if (!active || scheduledRevision !== revision) return;
        if (!accumulatedText.trim()) return;
        params.render(accumulatedText);
      });
    },

    invalidate() {
      active = false;
      revision += 1;
      frameScheduled = false;
    },
  };
}
