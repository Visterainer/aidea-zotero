# Translation environment catalog

The published catalog lives in `site/public/translate-env/` and is deployed by GitHub Pages. It can be updated without releasing a new Zotero plugin. The plugin accepts only the fixed Pages URL, bridge API `1`, and a lock file whose SHA-256 matches the manifest.

The weekly `Propose Translation Environment Update` workflow checks PyPI for newer `pdf2zh-next` and `BabelDOC` releases, generates a candidate universal lock, tests it on Linux, macOS, and Windows, then opens a PR. Review bridge compatibility before merging. The Pages deployment runs the same smoke tests and will not publish a failing catalog. Keep `bitstring` and other compatibility pins in `requirements.in` until their replacements pass these tests. **Never change a published revision in place**; increment `revision` and create a new `requirements-<revision>.lock`.

For a manual candidate, edit `requirements.in`, increment the manifest revision, run `uv pip compile site/public/translate-env/requirements.in --universal --python-version 3.12 --no-annotate --only-binary :all: --generate-hashes --output-file site/public/translate-env/requirements-<revision>.lock`, update the manifest URL and SHA-256, then run `python scripts/translation-env/verify_manifest.py`. When releasing a new plugin, run `python scripts/translation-env/update_bundled.py` and format `src/modules/pdfTranslator/bundledEnvironment.ts` to refresh its offline fallback. A remote catalog with a newer bridge API requires a plugin release.

## Rules that keep released plugins working

- **Locks are hash-pinned.** Every requirement carries the SHA-256 of its files and the plugin installs with `--require-hashes`, so packages may be downloaded from a mirror without trusting it. The plugin rejects a lock with an unhashed line.
- **One manifest file per bridge API.** `manifest.json` is read by every plugin that speaks bridge API `1` and must keep `"bridgeApi": 1` forever; those plugins reject anything else and would show "online check failed" permanently. When the bridge API changes, publish `manifest-api2.json` next to it and point the new plugin's `TRANSLATION_ENV_URL` at that file. Platform differences do not need separate manifests: the lock is universal and carries environment markers.
- **Platform floors live in the plugin.** `describeUnsupportedTranslationPlatform` in `src/modules/pdfTranslator/environmentPolicy.ts` refuses macOS before 13, glibc before 2.28, musl and 32-bit systems before anything is downloaded. Re-check them when a candidate changes `onnx`, `onnxruntime` or other compiled packages:

  ```bash
  uv pip install --dry-run --require-hashes --only-binary :all: -r site/public/translate-env/requirements-<revision>.lock --python-platform x86_64-manylinux_2_28
  ```

  (`MACOSX_DEPLOYMENT_TARGET=13.0` with `--python-platform aarch64-apple-darwin` checks the macOS floor.)

- **Download source.** The plugin picks PyPI or a mainland-China mirror from the Zotero locale and retries with the other on failure. `extensions.zotero.aidea.translate.envDownloadSource` (`auto`, `official`, `mirror`) overrides it.
