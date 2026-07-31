## What's Changed

- **Safer Zotero item resolution**: AIdea now handles deleted, unavailable, or unresolved Zotero item IDs consistently across document context, selection translation, notes, file intake, paper search, and author profiles.
- **Improved attachment reliability**: missing parent items and attachments are treated as unavailable instead of leaking Zotero's internal `false` sentinel into application code.
- **Compatibility with updated Zotero types**: adapted all single-item lookups to the stricter `zotero-types` 4.1.3 return signatures, with regression coverage for both existing and missing items.
- **Development dependency maintenance**: updated `@types/node` to 26.1.2, ESLint to 10.8.0, Zotero Plugin Scaffold to 0.8.8, and `zotero-types` to 4.1.3 through #64 and #66.

This is a reliability and maintenance release with no new settings or visible interface changes.

After updating, restart Zotero before testing the new version.

## 更新内容

- **更安全的 Zotero 条目解析**：AIdea 现在会在文档上下文、划词翻译、笔记、文件导入、论文搜索和作者档案等路径中统一处理已删除、暂不可用或无法解析的 Zotero 条目 ID。
- **提高附件处理可靠性**：缺失的父条目和附件现在会被视为不可用，不再让 Zotero 内部使用的 `false` 哨兵值进入应用逻辑。
- **兼容新版 Zotero 类型定义**：所有单条目查询均已适配 `zotero-types` 4.1.3 更严格的返回类型，并增加现有条目和缺失条目的回归测试。
- **开发依赖维护**：通过 #64 和 #66，将 `@types/node` 更新至 26.1.2、ESLint 更新至 10.8.0、Zotero Plugin Scaffold 更新至 0.8.8、`zotero-types` 更新至 4.1.3。

这是一次可靠性与维护版本，没有新增设置或可见的界面变化。

更新后请重启 Zotero，再测试新版本。
