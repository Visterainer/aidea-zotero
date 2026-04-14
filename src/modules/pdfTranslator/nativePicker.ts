/* ---------------------------------------------------------------------------
 * pdfTranslator/nativePicker.ts  –  System-native file & directory picker
 *
 * Uses zotero-plugin-toolkit's FilePickerHelper which wraps Zotero's built-in
 * FilePicker ESModule (chrome://zotero/content/modules/filePicker.mjs).
 *
 * This calls the OS-native file dialog on all platforms:
 *   - Windows: Explorer dialog
 *   - macOS:   Finder dialog
 *   - Linux:   GTK/Qt file dialog
 *
 * Compatible with Zotero 7 and 8 (toolkit ≥ 5.1.0).
 * -------------------------------------------------------------------------*/

import { FilePickerHelper } from "zotero-plugin-toolkit";

/**
 * Open a system-native file picker to select a single PDF file.
 *
 * @param _win  unused (kept for API compatibility); FilePickerHelper
 *              resolves the parent window automatically via getGlobal("window")
 * @returns     absolute path to the selected file, or `null` if cancelled
 */
export async function pickPdfFile(_win?: Window): Promise<string | null> {
  try {
    const result = await new FilePickerHelper(
      "Select PDF",
      "open",
      [["PDF Files (*.pdf)", "*.pdf"]],
    ).open();
    // FilePickerHelper returns `false` on cancel, or a path string on success
    if (result === false) return null;
    return result as string;
  } catch {
    return null;
  }
}

/**
 * Open a system-native directory picker to select a save directory.
 *
 * @param _win  unused (kept for API compatibility)
 * @returns     absolute path to the selected directory, or `null` if cancelled
 */
export async function pickDirectory(_win?: Window): Promise<string | null> {
  try {
    const result = await new FilePickerHelper(
      "Select Save Directory",
      "folder",
    ).open();
    if (result === false) return null;
    return result as string;
  } catch {
    return null;
  }
}
