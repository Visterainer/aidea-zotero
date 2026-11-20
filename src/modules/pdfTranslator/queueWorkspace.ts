/* Retained output lives in the profile rather than the OS temporary directory:
 * failed deliveries must remain available after restarting Zotero. */
function workspaceRoot(): string {
  return PathUtils.join(PathUtils.profileDir, "aidea-translation-deliveries");
}

function localFile(path: string) {
  return Zotero.File.pathToFile(path);
}

export async function createQueueWorkspace(): Promise<string> {
  const root = workspaceRoot();
  await IOUtils.makeDirectory(root, {
    ignoreExisting: true,
    permissions: 0o700,
  });
  if (localFile(root).isSymlink())
    throw new Error("Invalid translation workspace");
  return IOUtils.createUniqueDirectory(root, "job", 0o700);
}

export async function validateQueueWorkspace(
  dir: string,
  files: string[],
): Promise<boolean> {
  try {
    const root = workspaceRoot();
    if (
      PathUtils.parent(dir) !== root ||
      !/^job(?:-?\d+)?$/.test(PathUtils.filename(dir)) ||
      localFile(root).isSymlink()
    )
      return false;
    const directory = localFile(dir);
    if (directory.isSymlink() || !directory.isDirectory()) return false;
    for (const path of files) {
      if (
        PathUtils.parent(path) !== dir ||
        !/\.pdf$/i.test(PathUtils.filename(path))
      )
        return false;
      const file = localFile(path);
      if (file.isSymlink() || !file.isFile() || file.fileSize <= 0)
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function cleanQueueWorkspace(
  dir: string,
  filed?: string[],
): Promise<boolean> {
  try {
    if (!(await validateQueueWorkspace(dir, filed || []))) return true;
    if (filed) {
      for (const path of new Set(filed))
        await IOUtils.remove(path, { ignoreAbsent: true });
      if ((await IOUtils.getChildren(dir)).length) return true; // e.g. a glossary
    }
    await IOUtils.remove(dir, { recursive: !filed, ignoreAbsent: true });
    return false;
  } catch {
    return true;
  }
}
