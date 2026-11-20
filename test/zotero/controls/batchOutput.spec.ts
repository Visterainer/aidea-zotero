import { assert } from "chai";
import {
  inspectTranslationOutputs,
  publishTranslationOutputs,
} from "../../../src/modules/pdfTranslator/translationOutputs";
import {
  createQueueWorkspace,
  validateQueueWorkspace,
  cleanQueueWorkspace,
} from "../../../src/modules/pdfTranslator/queueWorkspace";
import {
  stageLibraryItems,
  startBatch,
  getBatchDraft,
  removeDraftItem,
} from "../../../src/modules/pdfTranslator/translationBatch";

// Tiny valid, unencrypted one-page PDF; tests never contact a model or use the user's library.
function sample(text: string): string {
  const stream = `BT /F1 12 Tf 24 50 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 280 100] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let raw = "%PDF-1.4\n";
  const offsets = ["0000000000 65535 f "];
  for (const [i, obj] of objects.entries()) {
    offsets.push(`${String(raw.length).padStart(10, "0")} 00000 n `);
    raw += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  }
  return (
    raw +
    `xref\n0 ${offsets.length}\n${offsets.join("\n")}\ntrailer\n<< /Root 1 0 R /Size ${offsets.length} >>\nstartxref\n${raw.length}\n%%EOF\n`
  );
}

describe("batch PDF output in Zotero", function () {
  it("fills only a deleted folder copy without touching an annotated stored PDF; explicit overwrite keeps its ID", async function () {
    this.timeout(60000);
    const dir = await IOUtils.createUniqueDirectory(
      PathUtils.tempDir,
      "aidea-batch-native",
    );
    const parent = new Zotero.Item("journalArticle");
    parent.libraryID = Zotero.Libraries.userLibraryID;
    parent.setField("title", "Batch output fixture");
    await parent.saveTx();
    const stage = await createQueueWorkspace();
    const prefs: Record<string, string | boolean> = {
      "translate.outputAttach": true,
      "translate.outputSaveToDir": true,
      "translate.outputDir": dir,
      "translate.outputMono": true,
      "translate.outputDual": true,
      "translate.targetLang": "zh-CN",
      "lastUsedModelName.translate": "not-called",
    };
    const backups = Object.keys(prefs).map((key) => {
      const full = `extensions.zotero.aidea.${key}`;
      return [full, Zotero.Prefs.get(full, true)] as const;
    });
    let src: Zotero.Item | undefined;
    try {
      const input = PathUtils.join(dir, "Paper.pdf");
      await IOUtils.writeUTF8(input, sample("Original"));
      src = await Zotero.Attachments.importFromFile({
        file: input,
        parentItemID: parent.id,
      });
      const path = await src.getFilePathAsync();
      assert.isString(path);
      const intake = await stageLibraryItems([parent, src]);
      assert.equal(intake.added, 1);
      assert.equal(intake.duplicates, 1);
      assert.include(
        getBatchDraft().map((r) => r.attachmentID),
        src.id,
      );
      removeDraftItem(src.id);
      const target = { attach: true, saveDir: dir };
      const inspect = (overwrite: boolean) =>
        inspectTranslationOutputs(
          src!,
          String(path),
          "zh-CN",
          ["mono", "dual"],
          target,
          overwrite,
        );
      const files = ["mono", "dual"].map((k) =>
        PathUtils.join(stage, `Paper.zh-CN.${k}.pdf`),
      );
      for (const file of files)
        await IOUtils.writeUTF8(file, sample("First translation"));
      assert.isTrue(await validateQueueWorkspace(stage, files), stage);
      const first = await inspect(false);
      assert.sameMembers(first.generateKinds, ["mono", "dual"]);
      const delivery = await publishTranslationOutputs(
        first,
        files,
        [],
        () => {},
      );
      assert.lengthOf(delivery.savedFiles, 2);
      assert.lengthOf(delivery.itemIDs, 2);
      for (const [key, value] of Object.entries(prefs))
        Zotero.Prefs.set(`extensions.zotero.aidea.${key}`, value, true);
      await stageLibraryItems([src]);
      const previews: unknown[] = [];
      const preview = (overwrite: boolean) =>
        startBatch(overwrite, (s) => {
          previews.push(s);
          return false;
        });
      assert.isFalse(await preview(false));
      assert.deepInclude(previews.pop() as object, {
        documents: 1,
        skip: 1,
        generate: 0,
        missing: 0,
        replace: 0,
      });
      assert.isFalse(await preview(true));
      assert.deepInclude(previews.pop() as object, {
        documents: 1,
        skip: 0,
        generate: 1,
        missing: 0,
        replace: 4,
      });
      assert.lengthOf(
        getBatchDraft(),
        1,
        "cancelled preview must retain the draft",
      );
      const full = await inspect(false);
      assert.deepEqual(full.generateKinds, []);
      const mono = full.cells.find(
        (c) => c.destination === "attachment" && c.kind === "mono",
      )!;
      const dual = full.cells.find(
        (c) => c.destination === "folder" && c.kind === "dual",
      )!;
      const item = await Zotero.Items.getAsync(mono.itemID!);
      const before = Array.from(await IOUtils.read(mono.path!));
      const ann = new Zotero.Item("annotation");
      ann.libraryID = item.libraryID;
      ann.parentID = item.id;
      ann.annotationType = "highlight";
      ann.annotationText = "First translation";
      ann.annotationColor = "#ffff00";
      ann.annotationPageLabel = "1";
      ann.annotationSortIndex = "00000|000001|00010";
      ann.annotationPosition = JSON.stringify({
        pageIndex: 0,
        rects: [[24, 48, 104, 64]],
      });
      await ann.saveTx();
      const ids = parent.getAttachments().slice().sort();
      const position = ann.annotationPosition;
      await IOUtils.remove(dual.path!);
      assert.isFalse(await preview(false));
      assert.deepInclude(previews.pop() as object, {
        documents: 1,
        skip: 0,
        generate: 1,
        missing: 1,
        replace: 0,
      });
      const missing = await inspect(false);
      assert.deepEqual(missing.generateKinds, ["dual"]);
      await IOUtils.writeUTF8(files[1], sample("Only repair this folder"));
      await publishTranslationOutputs(missing, [files[1]], [], () => {});
      assert.deepEqual(Array.from(await IOUtils.read(mono.path!)), before);
      assert.deepEqual(parent.getAttachments().slice().sort(), ids);
      assert.include(
        item.getAnnotations().map((a) => a.id),
        ann.id,
      );
      assert.equal(ann.annotationPosition, position);
      assert.include(
        await IOUtils.readUTF8(dual.path!),
        "Only repair this folder",
      );
      const replacing = await inspect(true);
      assert.equal(replacing.cells.filter((c) => c.exists).length, 4);
      for (const f of files)
        await IOUtils.writeUTF8(f, sample("Explicit replacement"));
      await publishTranslationOutputs(replacing, files, [], () => {});
      assert.deepEqual(parent.getAttachments().slice().sort(), ids);
      assert.equal(
        (await inspect(false)).cells.find(
          (c) => c.kind === "mono" && c.destination === "attachment",
        )?.itemID,
        item.id,
      );
      assert.include(
        await IOUtils.readUTF8(mono.path!),
        "Explicit replacement",
      );
      assert.include(
        item.getAnnotations().map((a) => a.id),
        ann.id,
      );
    } finally {
      for (const [key, value] of backups) {
        if (value == null) Zotero.Prefs.clear(key, true);
        else Zotero.Prefs.set(key, value, true);
      }
      if (src) removeDraftItem(src.id);
      await parent.eraseTx();
      await cleanQueueWorkspace(stage);
      await IOUtils.remove(dir, { recursive: true });
    }
  });
});
