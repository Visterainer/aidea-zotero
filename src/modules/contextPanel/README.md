# Context Panel Architecture

This folder implements the reader/library side-panel chat experience.

## Core Modules

- `index.ts`: registration entrypoint (panel section, style injection, reader popup selection tracking).
- `buildUI.ts`: static panel DOM construction.
- `setupHandlers.ts`: runtime orchestration and event wiring across panel features.
- `chat.ts`: conversation load/render/send/retry/edit and streaming orchestration.
- `contextResolution.ts`: active context resolution and selected-text context state updates.
- `documentContext.ts`: format-neutral reader-document resolution and compatibility facade.
- `document/registry.ts`: adapter registry used to resolve supported attachment formats.
- `document/adapters/`: format-specific PDF and EPUB extraction/capability policies.
- `document/epub/packageReader.ts`: EPUB container/package, manifest, spine, EPUB 3 navigation, and EPUB 2 NCX reader.
- `document/epub/structure.ts`: publisher hierarchy construction independent of text ownership.
- `document/epub/contentExtractor.ts`: non-overlapping EPUB content-unit extraction and conservative structural fallbacks.
- `document/cache.ts`: shared extracted-text cache orchestration.
- `document/sectionRouting.ts`: logical section cards and deterministic publisher-label routing.
- `document/retrieval.ts`: format-neutral chunking, BM25/embedding retrieval, and prompt context construction.
- `pdfContext.ts`: stable compatibility exports for existing PDF callers.
- `paperContext.ts`: supplemental paper context construction.
- `notes.ts`: note export and assistant-response save flows.
- `shortcuts.ts`: quick-action shortcut render/edit/reorder behavior.

## Shared Domain Helpers

- `constants.ts`: context-panel constants and label helpers.
- `types.ts`: shared types.
- `state.ts`: in-memory module state caches/maps.
- `normalizers.ts`: canonical normalization helpers for selected text source, paper contexts, hashes, and positive integers.
- `readerSelection.ts`: shared reader-selection document traversal helpers used by popup and panel flows.
- `menuPositioning.ts`: reusable floating menu positioning functions.
- `prefHelpers.ts`: preference read/write wrappers for panel behavior.
- `textUtils.ts`: sanitization, prompt composition, status, and rendering helpers.

## Handler Subfolder

- `setupHandlers/domRefs.ts`: centralized DOM query/typing helper for panel elements.
- `setupHandlers/types.ts`: lightweight handler wiring types.
- `setupHandlers/controllers/menuController.ts`: floating menu open-state and positioning primitives.
- `setupHandlers/controllers/modelReasoningController.ts`: model-specific screenshot gating and reasoning label helpers.
- `setupHandlers/controllers/conversationHistoryController.ts`: history row/title/date normalization and shared history types.
- `setupHandlers/controllers/composeContextController.ts`: paper-context normalization and chip metadata formatting helpers.
- `setupHandlers/controllers/fileIntakeController.ts`: file drag/paste/upload parsing and attachment ingestion pipeline.
- `setupHandlers/controllers/sendFlowController.ts`: send/edit/retry request dispatch orchestration.

## Design Constraints

- Keep exported signatures stable for plugin entrypoints and persistence helpers.
- Keep DOM IDs/class names stable to preserve CSS and event behavior.
- Keep persistence schema/pref keys stable to avoid user data regressions.
- Add new reader formats through a `DocumentAdapter`; panel and selection callers must not add direct MIME branches.
- Keep format-specific presentation, warm-up, selection-context, retrieval-limit, and source-revision policies on the adapter.
- Preserve format-native structure in adapters when it becomes available rather than flattening it in panel code.
- Keep EPUB selection translation query-scoped and bounded; opening a book must not trigger full-text model context generation.
- Treat the EPUB 3 navigation document or EPUB 2 NCX as authoritative structure even when it is outside the spine; use explicit semantics, headings, then spine resources as progressively weaker fallbacks.
- Keep publisher hierarchy separate from non-overlapping text units. A parent navigation node aggregates descendants and must not duplicate their text.
- Do not infer chapters from filenames, TOC position, or label shape. Explicit labels can support user references, while unknown reading units remain generic sections.
- Keep retrieval chunks below content units, retain native paths/locators on chunk metadata, and never send the whole book merely because it was extracted.
- Route explicit publisher section labels locally, reuse prior section IDs only for ambiguous follow-ups, and fall back to normal retrieval when no label matches.
- Treat local section matches as retrieval priorities; an exact native selection anchor is the only hard local scope.
- Invalidate extracted context when the adapter's source revision changes instead of retaining successful attachment text for the entire process lifetime.
