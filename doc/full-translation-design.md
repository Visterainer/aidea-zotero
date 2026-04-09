# 全文翻译功能设计文档 v3

> 模块位置: `src/modules/pdfTranslator/`
> UI 入口: 侧面板标签页 "全文翻译 / Translate"
> 翻译引擎: [pdf2zh_next](https://github.com/PDFMathTranslate/PDFMathTranslate-next) (CLI 直接调用)

---

## 1. 架构概览

### 1.1 核心原则

- **无 Server**：不启动 Flask/HTTP 服务，无端口暴露
- **按需启动**：翻译时启动 subprocess，翻译完自动退出
- **一键环境**：自动安装 Python 环境 + pdf2zh_next
- **OAuth 透传**：将插件的 OAuth access_token 写入 config.toml 作为 API Key

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     AIdea Plugin (Zotero)                     │
│                                                               │
│  ┌─────────────────┐   ┌────────────────┐                    │
│  │  翻译标签页 UI   │──▶│ TranslateCtrl  │                    │
│  │  (buildUI.ts)    │   │  (index.ts)    │                    │
│  └─────────────────┘   └──────┬─────────┘                    │
│         ▲                     │                               │
│         │                     ├── 1. refreshOAuthToken()      │
│    500ms 轮询                 ├── 2. writeConfigToml()        │
│    progress.json              ├── 3. nsIProcess(pdf2zh_next)  │
│         │                     │                               │
│  ┌──────┴──────┐        ┌─────▼──────────┐                   │
│  │ progress    │◀───────│ aidea_bridge   │                   │
│  │  .json      │        │   .py          │                   │
│  │ (进度状态)   │        │ (包装脚本)     │                   │
│  └─────────────┘        └─────┬──────────┘                   │
│                               │                               │
│                          调用 pdf2zh_next CLI                  │
│                          解析 stdout 写进度                    │
└───────────────────────────────┼───────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   pdf2zh_next venv     │
                    │   (uv 管理的虚拟环境)   │
                    │                       │
                    │  输入: paper.pdf       │
                    │  输出:                 │
                    │   ├── paper.mono.pdf   │
                    │   └── paper.dual.pdf   │
                    └───────────────────────┘
```

### 1.3 数据流

```
用户点击"开始翻译"
  │
  ├─ 1. 检查环境 (uv + venv + pdf2zh_next 是否就绪)
  │     └─ 未就绪 → 提示点击"配置环境"按钮
  │
  ├─ 2. 刷新 OAuth token
  │     └─ 失败 → 提示"请先在设置中登录"
  │
  ├─ 3. 生成 config.toml (临时文件)
  │     ├─ openaicompatible = true
  │     ├─ openai_compatible_api_key = <access_token>
  │     ├─ openai_compatible_base_url = <provider endpoint>
  │     └─ openai_compatible_model = <用户选择的翻译模型>
  │
  ├─ 4. 启动 aidea_bridge.py (nsIProcess)
  │     └─ 内部运行: pdf2zh_next paper.pdf --openaicompatible ...
  │
  ├─ 5. 轮询 progress.json (每 500ms)
  │     └─ 更新进度条 + 状态文字
  │
  ├─ 6. 翻译完成
  │     ├─ 从输出目录收集 mono.pdf / dual.pdf
  │     ├─ 复制到用户指定的输出路径
  │     └─ UI 显示 ✅ 完成
  │
  └─ 7. subprocess 自动退出
```

---

## 2. 环境管理

### 2.1 一键配置环境

翻译标签页中有一个 **"配置翻译环境"** 按钮，点击后自动完成全部安装。

#### 安装流程

```
第 1 步: 安装 uv (Python 包管理器，~3MB)
  ├─ Windows: powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
  ├─ macOS:   curl -LsSf https://astral.sh/uv/install.sh | sh
  └─ Linux:   curl -LsSf https://astral.sh/uv/install.sh | sh

第 2 步: 创建虚拟环境
  └─ uv venv {pluginDataDir}/aidea-translate-env --python 3.12

第 3 步: 安装 pdf2zh_next
  └─ uv pip install pdf2zh_next --python {pluginDataDir}/aidea-translate-env
```

#### 路径规划

| 项目 | 路径 |
|------|------|
| uv 二进制 | 系统 PATH 或 `~/.local/bin/uv` |
| 虚拟环境 | `{Zotero.DataDirectory}/extensions/aidea-translate-env/` |
| pdf2zh_next 可执行文件 | `{venvDir}/bin/pdf2zh_next` (Unix) 或 `{venvDir}/Scripts/pdf2zh_next.exe` (Win) |
| 桥接脚本 | `{addonDir}/scripts/aidea_bridge.py` (随插件分发) |
| 临时 config.toml | `{Zotero.TempDirectory}/aidea_translate_config.toml` |
| 进度文件 | `{Zotero.TempDirectory}/aidea_translate_progress.json` |

#### 环境状态检测

```typescript
async function checkEnvironment(): Promise<EnvStatus> {
  // 1. 检查 uv 是否可用
  const uvPath = await findUvBinary();
  if (!uvPath) return { status: "no_uv" };

  // 2. 检查虚拟环境是否存在
  const venvDir = getVenvDir();
  if (!await IOUtils.exists(venvDir)) return { status: "no_venv" };

  // 3. 检查 pdf2zh_next 是否已安装
  const pdf2zhBin = getPdf2zhBinary(venvDir);
  if (!await IOUtils.exists(pdf2zhBin)) return { status: "no_pdf2zh" };

  return { status: "ready", venvDir, pdf2zhBin };
}
```

按钮状态：
- 环境未就绪 → 显示 **"⬇️ 配置翻译环境"**
- 安装中 → 显示 **"⏳ 安装中..."** + 安装进度
- 环境就绪 → 显示 **"✅ 环境就绪"** (禁用)

### 2.2 跨平台兼容

| 平台 | uv 安装方式 | Python 路径 | pdf2zh_next 路径 |
|------|------------|-------------|------------------|
| Windows | PowerShell 脚本 | `{venv}/Scripts/python.exe` | `{venv}/Scripts/pdf2zh_next.exe` |
| macOS | curl + sh | `{venv}/bin/python` | `{venv}/bin/pdf2zh_next` |
| Linux | curl + sh | `{venv}/bin/python` | `{venv}/bin/pdf2zh_next` |

---

## 3. 桥接脚本 aidea_bridge.py

随插件分发在 `addon/scripts/aidea_bridge.py`，约 80 行。

### 3.1 职责

1. 读取插件写入的 `task.json`（翻译参数）
2. 构建 pdf2zh_next CLI 命令
3. 运行 pdf2zh_next 为子进程
4. **解析 stdout/stderr 提取进度信息**
5. 将进度写入 `progress.json`（插件轮询读取）
6. 翻译完成后写入最终状态

### 3.2 伪代码

```python
#!/usr/bin/env python3
"""AIdea Translation Bridge - 桥接 Zotero 插件与 pdf2zh_next"""

import json, sys, os, subprocess, re, time

def main():
    task = json.load(open(sys.argv[1], encoding='utf-8'))
    progress_file = task["progressFile"]
    
    # 构建 pdf2zh_next CLI 命令
    cmd = [
        task["pdf2zhBin"],
        task["pdfPath"],
        "--openaicompatible",
        "--qps", str(task.get("qps", 10)),
        "--output", task["outputDir"],
        "--lang-in", task["sourceLang"],
        "--lang-out", task["targetLang"],
        "--config-file", task["configFile"],
        "--watermark-output-mode", "no_watermark",
    ]
    
    if task.get("noDual"):
        cmd.append("--no-dual")
    if task.get("noMono"):
        cmd.append("--no-mono")
    
    # 写入初始进度
    write_progress(progress_file, {
        "status": "running",
        "progress": 0,
        "message": "正在初始化翻译引擎...",
        "startTime": time.time(),
    })
    
    # 启动 pdf2zh_next 进程
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
    )
    
    # 实时解析 stdout 中的进度
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        
        # 解析进度模式 (pdf2zh_next 输出类似 "Translating: 100%|████| 8/19")
        match = re.search(r'(\d+)/(\d+)', line)
        if match:
            current, total = int(match.group(1)), int(match.group(2))
            pct = round(current / total * 100) if total > 0 else 0
            write_progress(progress_file, {
                "status": "running",
                "progress": pct,
                "current": current,
                "total": total,
                "message": f"翻译中 {current}/{total} 页...",
            })
    
    # 等待进程结束
    returncode = proc.wait()
    
    if returncode == 0:
        # 收集输出文件
        output_files = [f for f in os.listdir(task["outputDir"])
                       if f.endswith('.pdf') and ('mono' in f or 'dual' in f)]
        write_progress(progress_file, {
            "status": "done",
            "progress": 100,
            "message": "翻译完成",
            "outputFiles": output_files,
        })
    else:
        write_progress(progress_file, {
            "status": "error",
            "progress": 0,
            "message": f"翻译失败 (exit code: {returncode})",
        })

def write_progress(path, data):
    tmp = path + ".tmp"
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)  # 原子写入

if __name__ == "__main__":
    main()
```

### 3.3 progress.json 格式

```json
{
  "status": "running",       // "running" | "done" | "error" | "cancelled"
  "progress": 42,            // 0-100
  "current": 8,              // 当前页
  "total": 19,               // 总页数
  "message": "翻译中 8/19 页...",
  "outputFiles": [],          // 翻译完成后填充
  "startTime": 1743580000
}
```

---

## 4. 插件侧模块设计

### 4.1 模块清单

| 文件 | 职责 |
|------|------|
| `src/modules/pdfTranslator/index.ts` | **重写** — 翻译流程编排器 |
| `src/modules/pdfTranslator/envManager.ts` | **新建** — 环境检测 + 一键安装 |
| `src/modules/pdfTranslator/processRunner.ts` | **新建** — nsIProcess 启动和管理 |
| `src/modules/pdfTranslator/configWriter.ts` | **新建** — 生成 config.toml + task.json |
| `src/modules/pdfTranslator/progressPoller.ts` | **新建** — 轮询 progress.json |
| `addon/scripts/aidea_bridge.py` | **新建** — Python 桥接脚本 |

### 4.2 index.ts — 翻译编排器

```typescript
export class TranslateController {
  private process: nsIProcess | null = null;
  private poller: ProgressPoller | null = null;
  
  // 开始翻译
  async start(params: TranslateParams): Promise<void> {
    // 1. 检查环境
    const env = await checkEnvironment();
    if (env.status !== "ready") throw new Error("环境未就绪");
    
    // 2. 刷新 OAuth token
    const token = await refreshOAuthToken();
    
    // 3. 写 config.toml（含 token）
    const configPath = await writeConfigToml({
      model: params.modelId,
      apiKey: token,
      apiUrl: getProviderEndpoint(),
    });
    
    // 4. 写 task.json（翻译参数）
    const taskPath = await writeTaskJson({
      pdf2zhBin: env.pdf2zhBin,
      pdfPath: params.pdfPath,
      outputDir: params.outputDir,
      configFile: configPath,
      sourceLang: "en",
      targetLang: params.targetLang,
      noDual: !params.generateDual,
      noMono: !params.generateMono,
      progressFile: getProgressFilePath(),
    });
    
    // 5. 启动 aidea_bridge.py
    this.process = await runProcess(env.pythonBin, [
      getBridgeScriptPath(),
      taskPath,
    ]);
    
    // 6. 开始轮询进度
    this.poller = new ProgressPoller(getProgressFilePath(), (data) => {
      this.onProgress(data);
    });
    this.poller.start();
  }
  
  // 暂停（取消当前进程）
  pause(): void {
    this.process?.kill();
    this.poller?.stop();
  }
  
  // 清除缓存
  async clearCache(outputDir: string): Promise<void> {
    await IOUtils.remove(outputDir, { recursive: true });
  }
}
```

### 4.3 envManager.ts — 环境管理器

```typescript
export async function checkEnvironment(): Promise<EnvStatus>;
export async function installEnvironment(
  onProgress: (step: string, percent: number) => void
): Promise<void>;

// 内部步骤：
// 1. installUv() — 平台检测 + 执行安装脚本
// 2. createVenv() — uv venv ... --python 3.12
// 3. installPdf2zh() — uv pip install pdf2zh_next
```

### 4.4 configWriter.ts — 配置文件生成

生成两个文件：

**config.toml**（pdf2zh_next 翻译配置）：
```toml
openaicompatible = true

[translation]
lang_in = "en"
lang_out = "zh-CN"
qps = 10

[pdf]
no_dual = false
no_mono = false
watermark_output_mode = "no_watermark"

[openaicompatible_detail]
translate_engine_type = "OpenAICompatible"
support_llm = "yes"
openai_compatible_model = "gemini-3.1-pro-preview"
openai_compatible_base_url = "https://generativelanguage.googleapis.com/v1beta/openai"
openai_compatible_api_key = "<OAuth access_token>"
```

**task.json**（传给桥接脚本的参数）：
```json
{
  "pdf2zhBin": "/path/to/venv/bin/pdf2zh_next",
  "pdfPath": "/path/to/paper.pdf",
  "outputDir": "/path/to/output",
  "configFile": "/tmp/aidea_translate_config.toml",
  "progressFile": "/tmp/aidea_translate_progress.json",
  "sourceLang": "en",
  "targetLang": "zh-CN",
  "noDual": false,
  "noMono": false,
  "qps": 10
}
```

### 4.5 processRunner.ts — 进程管理

```typescript
export async function runProcess(
  executable: string,
  args: string[],
): Promise<nsIProcess>;

export function killProcess(proc: nsIProcess): void;
```

使用 Gecko `nsIProcess` API：
```typescript
const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
file.initWithPath(executable);
const process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
process.init(file);
process.runAsync(args, args.length);  // 非阻塞
```

### 4.6 progressPoller.ts — 进度轮询

```typescript
export class ProgressPoller {
  private timer: number | null = null;
  
  constructor(
    private filePath: string,
    private callback: (data: ProgressData) => void,
    private intervalMs = 500,
  ) {}
  
  start(): void {
    this.timer = setInterval(async () => {
      try {
        const text = await IOUtils.readUTF8(this.filePath);
        const data = JSON.parse(text);
        this.callback(data);
        if (data.status === "done" || data.status === "error") {
          this.stop();
        }
      } catch { /* 文件还不存在或正在写入 */ }
    }, this.intervalMs);
  }
  
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
```

---

## 5. UI 设计

### 5.1 完整布局

```
┌──────────────────────────────────────┐
│ [论文对话│划词释义│全文翻译│知识框架]  │
├──────────────────────────────────────┤
│                                      │
│  ⚙️ 翻译环境                         │
│  [✅ 环境就绪]  或  [⬇️ 配置翻译环境] │
│                                      │
│  📂 输出路径                          │
│  [/Users/.../output       ] [选择…]  │
│                                      │
│  ── 输出格式 ──                       │
│  [🟢 ON ] 双语 PDF（原文+译文对照）   │
│  [🟢 ON ] 单语 PDF（仅目标语言）      │
│                                      │
│  ── 翻译设置 ──                       │
│  🌐 目标语言: [简体中文 ▼]            │
│  🤖 翻译模型: [gemini-3.1 ▼]         │
│                                      │
│  ── 任务状态 ──                       │
│  📄 Attention_Is_All_You_Need.pdf    │
│  [████████░░░░░░░░░░░░] 42%          │
│  🟢 翻译中 · 第 8/19 页              │
│                                      │
│  [▶ 开始]  [⏸ 暂停]  [🗑 清除缓存]   │
│                                      │
└──────────────────────────────────────┘
```

### 5.2 按钮状态机

| 当前状态 | 环境按钮 | 开始/继续 | 暂停 | 清除 |
|----------|---------|-----------|------|------|
| 环境未就绪 | ⬇️ 配置环境 | 禁用 | 禁用 | 禁用 |
| 环境安装中 | ⏳ 安装中... | 禁用 | 禁用 | 禁用 |
| 就绪，无 PDF | ✅ 就绪 | 禁用 | 禁用 | 禁用 |
| 就绪，空闲 | ✅ 就绪 | ▶ **开始** | 禁用 | 禁用 |
| 就绪，有缓存 | ✅ 就绪 | ▶ **继续** | 禁用 | ✅ |
| 翻译中 | ✅ 就绪 | 禁用 | ⏸ **暂停** | 禁用 |
| 翻译完成 | ✅ 就绪 | 禁用 (✅) | 禁用 | ✅ |
| 翻译出错 | ✅ 就绪 | 🔄 **重试** | 禁用 | ✅ |

### 5.3 暂停/恢复逻辑

| 操作 | 实现 |
|------|------|
| **暂停** | `nsIProcess.kill()` 终止 bridge 脚本和 pdf2zh_next 子进程。pdf2zh_next 内建缓存，中断的翻译不会丢失。 |
| **继续** | 重新启动翻译流程。pdf2zh_next 自动检测缓存，跳过已翻译的页，从断点继续。 |
| **清除缓存** | 删除输出目录。同时清除 pdf2zh_next 内部缓存（如有）。按钮恢复为"开始"。 |

---

## 6. 配置偏好汇总

| 偏好键 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `aidea.translateOutputPath` | string | `""` | 输出目录路径 |
| `aidea.translateModel` | string | `""` | 翻译专用模型 ID |
| `aidea.translateTargetLang` | string | `zh-CN` | 目标翻译语言 |
| `aidea.translateBilingual` | bool | `true` | 生成双语 PDF |
| `aidea.translateMonolingual` | bool | `true` | 生成单语 PDF |
| `aidea.translateEnvReady` | bool | `false` | 环境是否已配置 |
| `aidea.translateVenvDir` | string | `""` | 虚拟环境路径 |

---

## 7. 目标语言列表

| 代码 | 显示名 |
|------|--------|
| `zh-CN` | 简体中文 |
| `zh-TW` | 繁體中文 |
| `en` | English |
| `ja` | 日本語 |
| `ko` | 한국어 |
| `fr` | Français |
| `de` | Deutsch |
| `es` | Español |
| `ru` | Русский |
| `pt` | Português |

---

## 8. 输出文件命名

pdf2zh_next 的标准输出命名规则（`--watermark-output-mode no_watermark`）：

| 参数 | 输出文件名 |
|------|-----------|
| `mono` | `{name}.no_watermark.{lang}.mono.pdf` |
| `dual` | `{name}.no_watermark.{lang}.dual.pdf` |

输出目录结构：
```
{用户选择的输出路径}/
├── paper.no_watermark.zh-CN.mono.pdf    ← 纯中文版
└── paper.no_watermark.zh-CN.dual.pdf    ← 中英对照版
```

---

## 9. 文件改动清单

### 删除（废弃旧管线）

| 文件 | 说明 |
|------|------|
| `pdfPageExtractor.ts` | pdf.js 提取 → pdf2zh_next 内部处理 |
| `translateScheduler.ts` | LLM 逐页翻译 → pdf2zh_next 内部处理 |
| `pdfOutputGenerator.ts` | HTML→PDF → pdf2zh_next 直接生成 PDF |

### 新建

| 文件 | 说明 |
|------|------|
| `src/modules/pdfTranslator/envManager.ts` | 环境检测 + uv + venv + pdf2zh_next 安装 |
| `src/modules/pdfTranslator/processRunner.ts` | nsIProcess 启动/终止管理 |
| `src/modules/pdfTranslator/configWriter.ts` | 生成 config.toml + task.json |
| `src/modules/pdfTranslator/progressPoller.ts` | 轮询 progress.json 并回调 |
| `addon/scripts/aidea_bridge.py` | Python 桥接脚本（随插件分发） |

### 修改

| 文件 | 说明 |
|------|------|
| `src/modules/pdfTranslator/index.ts` | 重写 — 翻译流程编排 |
| `src/modules/contextPanel/buildUI.ts` | 翻译标签页完整 UI 构建 |
| `addon/content/zoteroPane.css` | toggle、进度条、环境状态、按钮组样式 |
| `src/modules/contextPanel/i18n.ts` | 翻译面板文案 |

---

## 10. 实施顺序

| 阶段 | 内容 | 验证标准 |
|------|------|---------|
| **Phase 1** | `envManager.ts` — 环境检测 + 安装 | 能检测 uv / 能自动安装 pdf2zh_next |
| **Phase 2** | `aidea_bridge.py` + `processRunner.ts` | 能从 Zotero 启动 pdf2zh_next 翻译 PDF |
| **Phase 3** | `configWriter.ts` — OAuth token 写入 | 能用 OAuth 模型完成翻译 |
| **Phase 4** | `progressPoller.ts` — 进度轮询 | 进度条实时更新 |
| **Phase 5** | 翻译标签页完整 UI | 可交互的完整界面 |
| **Phase 6** | 暂停/恢复/清除缓存 | 完整任务管理 |
| **Phase 7** | 清理旧模块 + 测试 | 发布就绪 |

---

## 11. 风险与应对

| 风险 | 应对 |
|------|------|
| uv 安装被杀毒软件拦截 | 提供手动安装指引页面作为 fallback |
| 首次安装耗时长（~500MB） | 安装进度条 + 估计时间；提示走一次即可 |
| nsIProcess 不支持 stdout 实时读取 | 已通过 bridge 脚本 + progress.json 文件绕过 |
| OAuth token 过期（1h 有效期） | 翻译前自动刷新；长翻译中途过期需处理 |
| pdf2zh_next stdout 进度格式变化 | bridge 脚本兼容多种 regex 模式 |
| Windows 下 Python 路径含空格 | 使用引号包裹路径 |
| pdf2zh_next 首次运行下载字体资源 | 桥接脚本捕获资源下载阶段写入进度 |

---

## 12. 与 pdf2zh 项目的关系

| 维度 | 说明 |
|------|------|
| **使用方式** | 仅使用 `pdf2zh_next` PyPI 包作为翻译引擎 |
| **不使用** | 不使用 `server.py`、Flask、HTTP 通信 |
| **复用模式** | 参考 `config.toml` 格式、CLI 参数、输出命名规则 |
| **核心差异** | 我们通过 `openaicompatible` 服务传入 OAuth token，无需用户自配 API Key |
| **许可证** | pdf2zh_next 为 GPL-3.0，我们仅调用其 CLI（非链接），符合使用条款 |
