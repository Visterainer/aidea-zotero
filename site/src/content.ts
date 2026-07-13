import type { Locale } from "./i18n";

export type PageData = {
  locale: Locale;
  title: string;
  description: string;
  badge: string;
  hero: {
    eyebrow: string;
    heading: string;
    subheading: string;
    primaryCta: string;
    secondaryCta: string;
    tertiaryCta: string;
    metrics: { label: string; value: string }[];
  };
  nav: {
    story: string;
    features: string;
    install: string;
    github: string;
  };
  trust: {
    kicker: string;
    heading: string;
    items: { title: string; body: string }[];
  };
  story: {
    kicker: string;
    heading: string;
    body: string;
    bullets: string[];
    panelLabel: string;
    panelCaption: string;
    secondaryPanelLabel: string;
    secondaryPanelCaption: string;
  };
  featureSection: {
    kicker: string;
    heading: string;
    body: string;
    cards: { title: string; body: string; meta: string }[];
  };
  translation: {
    kicker: string;
    heading: string;
    body: string;
    captions: string[];
    panelAlt: string;
  };
  install: {
    kicker: string;
    heading: string;
    body: string;
    steps: string[];
    note: string;
  };
  footer: {
    summary: string;
    releaseLabel: string;
    docsLabel: string;
    githubLabel: string;
    issuesLabel: string;
    licenseLabel: string;
    projectTitle: string;
    communityTitle: string;
    communityBody: string;
  };
};

export type HeadingKey =
  "hero" | "trust" | "story" | "feature" | "translation" | "install";

export type HeadingFragment = {
  text: string;
  accent?: boolean;
  keep?: boolean;
};

const plain = (text: string): HeadingFragment => ({ text });
const accent = (text: string): HeadingFragment => ({ text, accent: true });
const accentKeep = (text: string): HeadingFragment => ({
  text,
  accent: true,
  keep: true,
});

export const headingFragments: Record<
  Locale,
  Record<HeadingKey, HeadingFragment[]>
> = {
  "zh-CN": {
    hero: [
      plain("在 Zotero 里"),
      accentKeep("读论文"),
      plain("、"),
      accentKeep("提问"),
      plain("和"),
      accentKeep("整理笔记"),
      plain("。"),
    ],
    trust: [plain("一个适合长期使用的"), accentKeep("研究插件"), plain("。")],
    story: [
      plain("围绕"),
      accentKeep("阅读"),
      plain("、"),
      accentKeep("摘录"),
      plain("和"),
      accentKeep("整理"),
      plain("的实际流程设计。"),
    ],
    feature: [plain("覆盖"), accentKeep("论文阅读"), plain("中最常见的任务。")],
    translation: [accentKeep("整篇翻译"), plain("也能留在 Zotero 内完成。")],
    install: [accentKeep("几步安装"), plain("，直接开始使用。")],
  },
  "zh-TW": {
    hero: [
      plain("在 Zotero 裡"),
      accentKeep("讀論文"),
      plain("、"),
      accentKeep("提問"),
      plain("和"),
      accentKeep("整理筆記"),
      plain("。"),
    ],
    trust: [plain("一個適合長期使用的"), accentKeep("研究外掛"), plain("。")],
    story: [
      plain("圍繞"),
      accentKeep("閱讀"),
      plain("、"),
      accentKeep("摘錄"),
      plain("與"),
      accentKeep("整理"),
      plain("的實際流程設計。"),
    ],
    feature: [plain("涵蓋"), accentKeep("論文閱讀"), plain("中最常見的任務。")],
    translation: [accentKeep("整篇翻譯"), plain("也能留在 Zotero 內完成。")],
    install: [accentKeep("幾步安裝"), plain("，直接開始使用。")],
  },
  en: {
    hero: [
      accent("Read"),
      plain(", "),
      accent("ask"),
      plain(", and "),
      accent("organize notes"),
      plain(" inside Zotero."),
    ],
    trust: [
      plain("A "),
      accent("research plugin"),
      plain(" built for ongoing use."),
    ],
    story: [
      plain("Built around real "),
      accent("reading"),
      plain(", "),
      accent("excerpting"),
      plain(", and "),
      accent("organizing"),
      plain(" work."),
    ],
    feature: [
      plain("Covers the tasks that come up most often while "),
      accent("reading papers"),
      plain("."),
    ],
    translation: [
      accent("Full-paper translation"),
      plain(" can stay inside Zotero."),
    ],
    install: [
      accent("Install it in a few steps"),
      plain(" and start using it."),
    ],
  },
  ja: {
    hero: [
      plain("Zotero の中で"),
      accentKeep("論文を読み"),
      plain("、"),
      accentKeep("質問し"),
      plain("、"),
      accentKeep("ノートを整理する"),
      plain("。"),
    ],
    trust: [
      plain("継続的な利用に向いた"),
      accentKeep("研究プラグイン"),
      plain("です。"),
    ],
    story: [
      plain(""),
      accentKeep("読む"),
      plain("、"),
      accentKeep("抜き出す"),
      plain("、"),
      accentKeep("整理する"),
      plain("流れに合わせて設計。"),
    ],
    feature: [
      plain("論文読解で頻繁に発生する"),
      accentKeep("作業"),
      plain("をまとめて扱えます。"),
    ],
    translation: [
      accentKeep("論文全体の翻訳"),
      plain("も Zotero の中で続けられます。"),
    ],
    install: [accentKeep("数ステップで導入"), plain("してすぐ使えます。")],
  },
  ko: {
    hero: [
      plain("Zotero 안에서 "),
      accent("읽고"),
      plain(", "),
      accent("묻고"),
      plain(", 노트를 "),
      accent("정리하세요"),
      plain("."),
    ],
    trust: [plain("오랫동안 쓰기 좋은 "), accent("연구 플러그인"), plain(".")],
    story: [
      plain(""),
      accent("읽기"),
      plain(", "),
      accent("발췌"),
      plain(", "),
      accent("정리"),
      plain("의 실제 흐름에 맞춰 설계했습니다."),
    ],
    feature: [
      plain("논문을 읽을 때 자주 마주치는 "),
      accent("작업"),
      plain("을 다룹니다."),
    ],
    translation: [
      accent("논문 전체 번역"),
      plain("도 Zotero 안에서 이어갈 수 있습니다."),
    ],
    install: [accent("몇 단계만으로"), plain(" 바로 사용할 수 있습니다.")],
  },
  fr: {
    hero: [
      accent("Lire"),
      plain(", "),
      accent("questionner"),
      plain(" et "),
      accent("organiser ses notes"),
      plain(" dans Zotero."),
    ],
    trust: [
      plain("Un "),
      accent("plugin de recherche"),
      plain(" pensé pour durer."),
    ],
    story: [
      plain("Conçu pour les vrais gestes de "),
      accent("lecture"),
      plain(", d'"),
      accent("extrait"),
      plain(" et d'"),
      accent("organisation"),
      plain("."),
    ],
    feature: [
      plain("Couvre les tâches qui reviennent le plus souvent pendant la "),
      accent("lecture d'articles"),
      plain("."),
    ],
    translation: [
      accent("La traduction intégrale"),
      plain(" peut rester dans Zotero."),
    ],
    install: [accent("Quelques étapes suffisent"), plain(" pour commencer.")],
  },
  de: {
    hero: [
      plain("In Zotero "),
      accent("lesen"),
      plain(", "),
      accent("fragen"),
      plain(" und Notizen "),
      accent("organisieren"),
      plain("."),
    ],
    trust: [
      plain("Ein "),
      accent("Forschungs-Plugin"),
      plain(" für den laufenden Alltag."),
    ],
    story: [
      plain("Entwickelt für "),
      accent("Lesen"),
      plain(", "),
      accent("Exzerpieren"),
      plain(" und "),
      accent("Ordnen"),
      plain(" in Zotero."),
    ],
    feature: [
      plain("Deckt die Aufgaben ab, die beim "),
      accent("Lesen von Papers"),
      plain(" ständig auftauchen."),
    ],
    translation: [
      accent("Auch Volltext-Übersetzungen"),
      plain(" bleiben in Zotero."),
    ],
    install: [
      accent("In wenigen Schritten"),
      plain(" installiert und einsatzbereit."),
    ],
  },
  es: {
    hero: [
      accent("Lee"),
      plain(", "),
      accent("pregunta"),
      plain(" y "),
      accent("organiza tus notas"),
      plain(" dentro de Zotero."),
    ],
    trust: [
      plain("Un "),
      accent("complemento de investigación"),
      plain(" pensado para el uso continuo."),
    ],
    story: [
      plain("Pensado para "),
      accent("leer"),
      plain(", "),
      accent("extraer"),
      plain(" y "),
      accent("organizar"),
      plain(" en el trabajo real."),
    ],
    feature: [
      plain("Cubre las tareas que más se repiten al "),
      accent("leer artículos"),
      plain("."),
    ],
    translation: [
      accent("La traducción completa"),
      plain(" también puede quedarse dentro de Zotero."),
    ],
    install: [accent("Bastan unos pocos pasos"), plain(" para empezar.")],
  },
  ru: {
    hero: [
      accent("Читайте статьи"),
      plain(", "),
      accent("задавайте вопросы"),
      plain(" и "),
      accent("ведите заметки"),
      plain(" в Zotero."),
    ],
    trust: [
      plain(""),
      accent("Исследовательский плагин"),
      plain(" для длительной работы."),
    ],
    story: [
      plain("Спроектирован под реальный процесс "),
      accent("чтения"),
      plain(", "),
      accent("выписок"),
      plain(" и "),
      accent("организации"),
      plain(" материалов."),
    ],
    feature: [
      plain("Закрывает задачи, которые чаще всего возникают при "),
      accent("чтении статей"),
      plain("."),
    ],
    translation: [
      accent("Полный перевод статьи"),
      plain(" тоже может оставаться внутри Zotero."),
    ],
    install: [accent("Несколько шагов"), plain(" — и можно начинать работу.")],
  },
  pt: {
    hero: [
      accent("Leia"),
      plain(", "),
      accent("pergunte"),
      plain(" e "),
      accent("organize notas"),
      plain(" dentro do Zotero."),
    ],
    trust: [
      plain("Um "),
      accent("plugin de pesquisa"),
      plain(" pensado para uso contínuo."),
    ],
    story: [
      plain("Projetado para o trabalho real de "),
      accent("leitura"),
      plain(", "),
      accent("extração"),
      plain(" e "),
      accent("organização"),
      plain("."),
    ],
    feature: [
      plain("Cobre as tarefas que aparecem com mais frequência na "),
      accent("leitura de artigos"),
      plain("."),
    ],
    translation: [
      accent("A tradução integral"),
      plain(" também pode permanecer dentro do Zotero."),
    ],
    install: [accent("Bastam alguns passos"), plain(" para começar.")],
  },
  ar: {
    hero: [
      accent("اقرأ"),
      plain(" و"),
      accent("اسأل"),
      plain(" و"),
      accent("نظّم ملاحظاتك"),
      plain(" داخل Zotero."),
    ],
    trust: [
      plain("إضافة "),
      accent("بحثية"),
      plain(" مناسبة للاستخدام المستمر."),
    ],
    story: [
      plain("مصمم لسير العمل الحقيقي في "),
      accent("القراءة"),
      plain(" و"),
      accent("الاقتباس"),
      plain(" و"),
      accent("التنظيم"),
      plain("."),
    ],
    feature: [
      plain("يغطي المهام التي تتكرر كثيراً أثناء "),
      accent("قراءة الأوراق العلمية"),
      plain("."),
    ],
    translation: [
      accent("ترجمة المقال كاملاً"),
      plain(" يمكن أن تبقى داخل Zotero."),
    ],
    install: [accent("بضع خطوات فقط"), plain(" للبدء.")],
  },
  hi: {
    hero: [
      plain("Zotero के भीतर "),
      accent("पढ़ें"),
      plain(", "),
      accent("पूछें"),
      plain(" और नोट्स "),
      accent("व्यवस्थित करें"),
      plain("।"),
    ],
    trust: [
      plain("लंबे समय की शोध-प्रक्रिया के लिए बना "),
      accent("शोध प्लगइन"),
      plain("।"),
    ],
    story: [
      plain(""),
      accent("पढ़ने"),
      plain(", "),
      accent("अंश निकालने"),
      plain(" और "),
      accent("व्यवस्थित करने"),
      plain(" के असली प्रवाह के लिए बना।"),
    ],
    feature: [
      plain("शोध-पत्र पढ़ते समय बार-बार आने वाले "),
      accent("काम"),
      plain(" सँभालता है।"),
    ],
    translation: [
      accent("पूरे शोध-पत्र का अनुवाद"),
      plain(" भी Zotero के भीतर रह सकता है।"),
    ],
    install: [accent("कुछ ही चरणों में"), plain(" शुरू करें।")],
  },
};

export const pageContent: Record<Locale, PageData> = {
  "zh-CN": {
    locale: "zh-CN",
    title: "AIdea for Zotero",
    description:
      "AIdea 是一个免费开源的 Zotero AI 插件，帮助研究者在文献库和 PDF 阅读器内完成问答、翻译、笔记整理与多模型接入。",
    badge: "免费开源 Zotero 插件",
    hero: {
      eyebrow: "给长期读论文、做笔记、写综述的人",
      heading: "在 Zotero 里读论文、提问和整理笔记。",
      subheading:
        "AIdea 是一个免费开源项目。它把对话、选段理解、全文翻译、多模型接入和本地记忆放进 Zotero，让你在论文阅读和资料整理过程中尽量少切网页、少丢上下文。",
      primaryCta: "安装插件",
      secondaryCta: "查看源码",
      tertiaryCta: "阅读文档",
      metrics: [
        { label: "价格", value: "免费开源" },
        { label: "存储方式", value: "本地优先" },
        { label: "使用界面", value: "文库 + PDF 阅读器" },
      ],
    },
    nav: {
      story: "适用场景",
      features: "主要能力",
      install: "如何安装",
      github: "GitHub",
    },
    trust: {
      kicker: "开源项目",
      heading: "一个适合长期使用的研究插件。",
      items: [
        {
          title: "免费开源，可直接看源码",
          body: "插件代码、文档和发布版本都在公开仓库中，适合自己安装、检查、反馈和持续改进。",
        },
        {
          title: "尽量不打断论文阅读流",
          body: "提问、总结、解释、翻译和笔记整理都留在 Zotero 侧栏，不需要在多个网页之间来回切换。",
        },
        {
          title: "数据和记忆本地优先",
          body: "聊天记录、记忆和授权状态优先保存在本地，插件本身不做平台式用户数据收集。",
        },
      ],
    },
    story: {
      kicker: "适用场景",
      heading: "围绕阅读、摘录和整理的实际流程设计。",
      body: "AIdea 面向的是正在阅读、摘录、比对和整理论文的人。你可以在 Zotero 侧栏里提问，把 PDF 选段直接带进上下文，把结果写回笔记，必要时继续做全文翻译。",
      bullets: [
        "同一套侧栏在文库视图和 PDF 阅读器里都可用。",
        "选段可直接进入上下文，回答更贴近原文而不是泛泛总结。",
        "有用的结果可以继续沉淀到 Zotero 笔记里，而不是停在一次性聊天记录中。",
      ],
      panelLabel: "侧栏问答",
      panelCaption: "围绕当前条目和论文正文继续提问、整理和记录。",
      secondaryPanelLabel: "模型与提供商",
      secondaryPanelCaption:
        "登录、切换模型和配置兼容接口都在同一个设置面板里。",
    },
    featureSection: {
      kicker: "主要能力",
      heading: "覆盖论文阅读中最常见的任务。",
      body: "AIdea 重点覆盖 Zotero 用户最常见的几类任务：围绕原文提问、切换模型、全文翻译，以及把结果沉淀回笔记。",
      cards: [
        {
          title: "先用起来，再慢慢配置",
          body: "OpenAI、Gemini、GitHub Copilot 可通过 OAuth 登录，也可以接入兼容 API，减少第一次上手的折腾。",
          meta: "先用起来",
        },
        {
          title: "围绕原文提问",
          body: "PDF 选段可以显式加入上下文，让回答尽量贴近论文具体段落，而不是脱离原文泛泛总结。",
          meta: "更贴近论文",
        },
        {
          title: "需要整篇翻译时也能继续做",
          body: "支持双语或单语 PDF 输出，适合需要通读外文论文、保留排版结构的场景。",
          meta: "适合长文",
        },
        {
          title: "多模型入口",
          body: "除官方提供商外，也可连接 Ollama、LM Studio、OpenRouter 等兼容端点，保持模型选择自由。",
          meta: "保持选择自由",
        },
        {
          title: "本地聊天与记忆",
          body: "聊天记录和长期记忆保存在 Zotero 本地数据库中，更适合持续几周或几个月的研究项目。",
          meta: "适合长期积累",
        },
        {
          title: "把结果沉淀回 Zotero",
          body: "Markdown、代码块、表格和 LaTeX 数学公式都能较完整地回写到 Zotero 笔记中。",
          meta: "结果能留下来",
        },
      ],
    },
    translation: {
      kicker: "全文翻译",
      heading: "整篇翻译也能留在 Zotero 内完成。",
      body: "翻译面板面向论文中的真实页面，包括结构图、公式和表格。这里展示的是仓库里已有的实际输出截图，不是营销示意图。",
      captions: ["架构图页面", "公式密集页面", "表格与正文混排"],
      panelAlt: "全文翻译面板",
    },
    install: {
      kicker: "安装方式",
      heading: "几步安装，直接开始使用。",
      body: "AIdea 通过 GitHub Releases 分发 `.xpi` 安装包。下载后在 Zotero 中从文件安装即可使用，整个项目免费开源。",
      steps: [
        "从 GitHub Releases 下载最新 `.xpi` 文件。",
        "在 Zotero 的附加组件界面中选择“从文件安装”。",
        "重启 Zotero 后，在 Library 或 PDF Reader 侧栏中启用 AIdea。",
      ],
      note: "如果你想了解实现方式、提交问题或参与改进，可以直接在 GitHub 仓库查看源码、Issue 和发布记录。",
    },
    footer: {
      summary:
        "AIdea 是一个免费开源的 Zotero 插件，服务对象是希望在论文阅读现场使用 AI 的研究者、学生和知识工作者。",
      releaseLabel: "安装插件",
      docsLabel: "项目文档",
      githubLabel: "GitHub 仓库",
      issuesLabel: "问题反馈",
      licenseLabel: "AGPL-3.0 许可证",
      projectTitle: "项目入口",
      communityTitle: "参与改进",
      communityBody:
        "欢迎通过 Issue 反馈问题、查看发布记录，或直接在仓库中了解实现细节。",
    },
  },
  en: {
    locale: "en",
    title: "AIdea for Zotero",
    description:
      "AIdea is a free and open-source Zotero AI plugin for paper-aware chat, translation, note taking, and multi-provider access inside your library and PDF reader.",
    badge: "Free & Open Source",
    hero: {
      eyebrow: "For people who read papers, take notes, and write reviews",
      heading: "Read, ask, and organize notes inside Zotero.",
      subheading:
        "AIdea is a free and open-source project. It keeps chat, passage grounding, full-document translation, multi-provider access, and local memory inside Zotero so you can stay with your library instead of juggling browser tabs.",
      primaryCta: "Install from Releases",
      secondaryCta: "View Source",
      tertiaryCta: "Read Docs",
      metrics: [
        { label: "Pricing", value: "Free & open" },
        { label: "Storage", value: "Local-first" },
        { label: "Surfaces", value: "Library + PDF" },
      ],
    },
    nav: {
      story: "Use Cases",
      features: "What It Does",
      install: "Install",
      github: "GitHub",
    },
    trust: {
      kicker: "Open Source",
      heading: "A research plugin built for ongoing use.",
      items: [
        {
          title: "Free, open, and easy to inspect",
          body: "The code, docs, and releases live in a public repository, so people can install it, inspect it, report issues, and improve it over time.",
        },
        {
          title: "Designed around the reading flow",
          body: "Asking, summarizing, translating, and note export stay in Zotero's side panel instead of bouncing across external chat tabs.",
        },
        {
          title: "Local-first for data and memory",
          body: "Chat history, memory, and auth state are stored locally first, and the plugin is not built around collecting platform user data.",
        },
      ],
    },
    story: {
      kicker: "Use Cases",
      heading: "Built around real reading, excerpting, and organizing work.",
      body: "AIdea is for people who read closely, excerpt passages, compare sources, and keep notes as they go. Ask in the side panel, attach exact PDF passages, write useful results back into notes, and move into full-document translation when needed.",
      bullets: [
        "The same side panel works in both the library view and the PDF reader.",
        "Selected PDF text can become explicit context for answers that stay closer to the source.",
        "Useful output can be saved back into Zotero instead of disappearing into one-off chat history.",
      ],
      panelLabel: "Side-panel workflow",
      panelCaption:
        "Ask, capture context, and keep notes attached to the current item.",
      secondaryPanelLabel: "Models and providers",
      secondaryPanelCaption:
        "Sign in, switch models, or configure compatible endpoints in one place.",
    },
    featureSection: {
      kicker: "Common Tasks",
      heading: "Covers the tasks that come up most often while reading papers.",
      body: "AIdea focuses on the parts of the workflow Zotero users come back to most often: asking against the source text, switching models, translating full papers, and saving useful output back into notes.",
      cards: [
        {
          title: "Get started before doing heavy setup",
          body: "OpenAI, Gemini, and GitHub Copilot can be used through OAuth, and compatible APIs can be added when you want more control.",
          meta: "Get started quickly",
        },
        {
          title: "Ask against the paper itself",
          body: "Selected PDF passages can be attached directly to the context so answers stay grounded in the source instead of drifting into vague summaries.",
          meta: "Stay grounded in the paper",
        },
        {
          title: "Keep going when the task becomes a full translation",
          body: "Export bilingual or mono-language PDFs when you need to read through an entire paper without losing layout structure.",
          meta: "Useful for whole papers",
        },
        {
          title: "Multi-provider routing",
          body: "Beyond built-in providers, users can connect Ollama, LM Studio, OpenRouter, and other compatible endpoints.",
          meta: "Keep provider choice open",
        },
        {
          title: "Local chat history and memory",
          body: "Conversations and long-lived memory stay in Zotero's local database, which fits ongoing research projects better.",
          meta: "Better for ongoing projects",
        },
        {
          title: "Save useful output back into Zotero",
          body: "Markdown, code blocks, tables, and LaTeX math can be written back into Zotero with much of their structure intact.",
          meta: "Save useful output",
        },
      ],
    },
    translation: {
      kicker: "Translation",
      heading: "Full-paper translation can stay inside Zotero.",
      body: "The translation panel is aimed at the pages that are actually difficult in academic papers, including diagrams, formulas, and tables. The gallery below shows real outputs already present in the repository, not marketing mockups.",
      captions: [
        "Architecture page",
        "Formula-heavy page",
        "Tables mixed with prose",
      ],
      panelAlt: "Full document translation panel",
    },
    install: {
      kicker: "Install",
      heading: "Install it in a few steps and start using it.",
      body: "AIdea is distributed through GitHub Releases as an `.xpi`. Download it, install it from file in Zotero, and start using it. The project is free and open source.",
      steps: [
        "Download the latest `.xpi` from GitHub Releases.",
        "Choose “Install Add-on From File” in Zotero's add-on interface.",
        "Restart Zotero and open AIdea from the Library or PDF Reader side panel.",
      ],
      note: "If you want to inspect the implementation, report a problem, or contribute improvements, everything is available in the GitHub repository.",
    },
    footer: {
      summary:
        "AIdea is a free and open-source Zotero plugin for researchers, students, and knowledge workers who want AI support to stay close to the reading surface.",
      releaseLabel: "Install Plugin",
      docsLabel: "Project Docs",
      githubLabel: "GitHub Repository",
      issuesLabel: "Report Issues",
      licenseLabel: "AGPL-3.0 License",
      projectTitle: "Project Links",
      communityTitle: "Contribute",
      communityBody:
        "You can follow releases, report problems, and inspect the implementation directly in the repository.",
    },
  },
  ja: {
    locale: "ja",
    title: "AIdea for Zotero",
    description:
      "AIdea は、論文に即した対話、翻訳、ノート整理、複数プロバイダー接続を Zotero の中で行える、無料のオープンソース AI プラグインです。",
    badge: "無料・オープンソース",
    hero: {
      eyebrow: "論文を読み、メモを取り、レビューを書く人のために",
      heading: "Zotero の中で論文を読み、質問し、ノートを整理する。",
      subheading:
        "AIdea は無料のオープンソースプロジェクトです。対話、本文選択の参照、全文翻訳、複数モデル接続、ローカルメモリを Zotero にまとめることで、ブラウザのタブを行き来せずに研究を続けられます。",
      primaryCta: "Releases からインストール",
      secondaryCta: "ソースコードを見る",
      tertiaryCta: "ドキュメントを読む",
      metrics: [
        { label: "料金", value: "無料・オープン" },
        { label: "保存方式", value: "ローカル優先" },
        { label: "利用画面", value: "Library + PDF" },
      ],
    },
    nav: {
      story: "利用シーン",
      features: "できること",
      install: "インストール",
      github: "GitHub",
    },
    trust: {
      kicker: "Open Source",
      heading: "継続的な研究作業に向けたプラグインです。",
      items: [
        {
          title: "無料で公開、実装も確認しやすい",
          body: "コード、ドキュメント、リリースは公開リポジトリにあり、導入、確認、報告、改善を続けやすくなっています。",
        },
        {
          title: "読む流れを崩しにくい設計",
          body: "質問、要約、翻訳、ノート保存を Zotero のサイドパネルで完結でき、外部チャット画面を行き来しません。",
        },
        {
          title: "データと記憶はローカル優先",
          body: "チャット履歴、記憶、認証状態はまずローカルに保存され、ユーザーデータ収集を前提にした設計ではありません。",
        },
      ],
    },
    story: {
      kicker: "利用シーン",
      heading: "読む、抜き出す、整理する流れに合わせて設計。",
      body: "AIdea は、論文を精読し、引用箇所を抜き出し、比較しながらノートを残す人向けです。サイドパネルで質問し、PDF の該当箇所をそのまま文脈に渡し、役立つ結果をノートへ戻し、必要なら全文翻訳へ進めます。",
      bullets: [
        "同じサイドパネルを Library と PDF Reader の両方で使えます。",
        "選択した PDF テキストを明示的な文脈として追加でき、回答が本文に寄りやすくなります。",
        "有用な出力を一時的なチャットで終わらせず、Zotero に保存できます。",
      ],
      panelLabel: "サイドパネル",
      panelCaption:
        "現在のアイテムに紐づいたまま質問し、文脈を集め、ノートを整理できます。",
      secondaryPanelLabel: "モデルとプロバイダー",
      secondaryPanelCaption:
        "サインイン、モデル切替、互換エンドポイント設定を 1 か所で行えます。",
    },
    featureSection: {
      kicker: "主な機能",
      heading: "論文読解で頻繁に発生する作業をまとめて扱えます。",
      body: "AIdea は、原文に基づく質問、モデル切替、全文翻訳、そして有用な出力のノート保存といった、Zotero ユーザーが繰り返し使う部分に焦点を当てています。",
      cards: [
        {
          title: "まず使い始めてから細かく調整",
          body: "OpenAI、Gemini、GitHub Copilot は OAuth で使い始められ、必要になれば互換 API を追加できます。",
          meta: "導入しやすい",
        },
        {
          title: "論文本文を前提に質問できる",
          body: "PDF の選択箇所を直接文脈へ加えられるため、回答が原文から離れにくくなります。",
          meta: "本文に寄せる",
        },
        {
          title: "必要になれば全文翻訳も続けられる",
          body: "レイアウトを保ったまま、対訳または単一言語の PDF を書き出せます。",
          meta: "長文向け",
        },
        {
          title: "複数モデルを接続",
          body: "内蔵プロバイダー以外にも、Ollama、LM Studio、OpenRouter などの互換エンドポイントを利用できます。",
          meta: "選択肢を保つ",
        },
        {
          title: "ローカルの履歴と記憶",
          body: "会話履歴と長期記憶は Zotero のローカルデータベースに保存され、継続的な研究プロジェクトに向いています。",
          meta: "継続利用向け",
        },
        {
          title: "役立つ結果を Zotero に戻す",
          body: "Markdown、コードブロック、表、LaTeX 数式をできるだけ保ったまま Zotero に保存できます。",
          meta: "結果を残せる",
        },
      ],
    },
    translation: {
      kicker: "全文翻訳",
      heading: "論文全体の翻訳も Zotero の中で続けられます。",
      body: "翻訳パネルは、図、数式、表のような学術論文で扱いにくいページを想定しています。下のギャラリーはマーケティング用画像ではなく、実際の出力例です。",
      captions: [
        "構成図のページ",
        "数式が多いページ",
        "表と本文が混在するページ",
      ],
      panelAlt: "全文翻訳パネル",
    },
    install: {
      kicker: "インストール",
      heading: "数ステップで導入してすぐ使えます。",
      body: "AIdea は GitHub Releases で `.xpi` として配布されています。ダウンロードして Zotero でファイルからインストールすれば使い始められます。プロジェクトは無料のオープンソースです。",
      steps: [
        "GitHub Releases から最新の `.xpi` をダウンロードします。",
        "Zotero のアドオン画面で「ファイルからアドオンをインストール」を選びます。",
        "Zotero を再起動し、Library または PDF Reader のサイドパネルから AIdea を開きます。",
      ],
      note: "実装の確認、問題報告、改善への参加は GitHub リポジトリから行えます。",
    },
    footer: {
      summary:
        "AIdea は、AI を読書面の近くに置いたまま研究したい研究者、学生、知識労働者向けの無料・オープンソース Zotero プラグインです。",
      releaseLabel: "プラグインを入手",
      docsLabel: "ドキュメント",
      githubLabel: "GitHub リポジトリ",
      issuesLabel: "Issue を報告",
      licenseLabel: "AGPL-3.0 ライセンス",
      projectTitle: "プロジェクト情報",
      communityTitle: "改善に参加",
      communityBody:
        "リリースの確認、問題報告、実装の確認をリポジトリ上で行えます。",
    },
  },
  de: {
    locale: "de",
    title: "AIdea for Zotero",
    description:
      "AIdea ist ein kostenloses Open-Source-AI-Plugin fuer Zotero, mit dem sich Chat, Uebersetzung, Notizen und Multi-Provider-Zugriff direkt in Bibliothek und PDF-Reader nutzen lassen.",
    badge: "Kostenlos & Open Source",
    hero: {
      eyebrow: "Fuer Menschen, die Papers lesen, markieren und zusammenfassen",
      heading: "In Zotero lesen, fragen und Notizen organisieren.",
      subheading:
        "AIdea ist ein kostenloses Open-Source-Projekt. Es bringt Chat, textnahe Rueckfragen, Volltext-Uebersetzung, mehrere Modellanbieter und lokale Erinnerung direkt in Zotero, damit der Arbeitsfluss nicht staendig in Browser-Tabs zerfaellt.",
      primaryCta: "Aus Releases installieren",
      secondaryCta: "Quellcode ansehen",
      tertiaryCta: "Dokumentation lesen",
      metrics: [
        { label: "Preis", value: "Kostenlos & offen" },
        { label: "Speicherung", value: "Local-first" },
        { label: "Oberflaechen", value: "Library + PDF" },
      ],
    },
    nav: {
      story: "Einsatzfaelle",
      features: "Funktionen",
      install: "Installation",
      github: "GitHub",
    },
    trust: {
      kicker: "Open Source",
      heading: "Ein Plugin fuer den laufenden Forschungsalltag.",
      items: [
        {
          title: "Kostenlos, offen und nachvollziehbar",
          body: "Code, Dokumentation und Releases liegen in einem oeffentlichen Repository und lassen sich direkt pruefen und weiterentwickeln.",
        },
        {
          title: "Auf den Leseprozess zugeschnitten",
          body: "Fragen, Zusammenfassen, Uebersetzen und Notizexport bleiben in der Zotero-Seitenleiste statt in externen Chat-Fenstern.",
        },
        {
          title: "Daten und Erinnerung lokal zuerst",
          body: "Chatverlauf, Erinnerung und Auth-Status werden zuerst lokal gespeichert. Das Projekt basiert nicht auf Plattform-Datensammlung.",
        },
      ],
    },
    story: {
      kicker: "Einsatzfaelle",
      heading: "Entwickelt fuer Lesen, Exzerpieren und Ordnen in Zotero.",
      body: "AIdea richtet sich an Menschen, die Papers genau lesen, Stellen markieren, Quellen vergleichen und ihre Notizen fortlaufend pflegen. Fragen in der Seitenleiste, Passagen aus dem PDF als Kontext hinzufuegen, Ergebnisse in Notizen zurueckschreiben und bei Bedarf in die Volltext-Uebersetzung wechseln.",
      bullets: [
        "Dieselbe Seitenleiste funktioniert in der Bibliothek und im PDF-Reader.",
        "Markierter PDF-Text kann als expliziter Kontext hinzugefuegt werden, damit Antworten naeher am Original bleiben.",
        "Nuetzliche Ergebnisse lassen sich in Zotero sichern statt in Einmal-Chatverlaeufen zu verschwinden.",
      ],
      panelLabel: "Seitenleisten-Workflow",
      panelCaption:
        "Fragen stellen, Kontext sammeln und Notizen direkt am aktuellen Eintrag halten.",
      secondaryPanelLabel: "Modelle und Anbieter",
      secondaryPanelCaption:
        "Anmelden, Modelle wechseln und kompatible Endpunkte an einem Ort konfigurieren.",
    },
    featureSection: {
      kicker: "Haeufige Aufgaben",
      heading:
        "Deckt die Aufgaben ab, die beim Lesen von Papers staendig auftauchen.",
      body: "AIdea konzentriert sich auf die Teile des Workflows, zu denen Zotero-Nutzer immer wieder zurueckkehren: Fragen am Quelltext, Modellwechsel, Volltext-Uebersetzung und das Rueckspeichern nuetzlicher Ergebnisse in Notizen.",
      cards: [
        {
          title: "Schnell starten und spaeter feiner einstellen",
          body: "OpenAI, Gemini und GitHub Copilot lassen sich ueber OAuth nutzen. Bei Bedarf koennen kompatible APIs spaeter ergaenzt werden.",
          meta: "Schneller Einstieg",
        },
        {
          title: "Fragen direkt am Paper",
          body: "Ausgewaehlte PDF-Passagen lassen sich direkt in den Kontext legen, damit Antworten enger am Originaltext bleiben.",
          meta: "Nah am Original",
        },
        {
          title: "Auch fuer komplette Uebersetzungen geeignet",
          body: "Zweisprachige oder einsprachige PDFs koennen exportiert werden, ohne das Layout der Arbeit zu verlieren.",
          meta: "Gut fuer lange Texte",
        },
        {
          title: "Mehrere Modellanbieter",
          body: "Neben eingebauten Anbietern lassen sich auch Ollama, LM Studio, OpenRouter und andere kompatible Endpunkte verbinden.",
          meta: "Wahlfreiheit behalten",
        },
        {
          title: "Lokaler Verlauf und Erinnerung",
          body: "Gespräche und langfristige Erinnerung bleiben in Zotero's lokaler Datenbank und passen gut zu laenger laufenden Projekten.",
          meta: "Fuer kontinuierliche Arbeit",
        },
        {
          title: "Nuetzliche Ergebnisse in Zotero sichern",
          body: "Markdown, Code, Tabellen und LaTeX koennen mit moeglichst viel Struktur nach Zotero zurueckgeschrieben werden.",
          meta: "Ergebnisse behalten",
        },
      ],
    },
    translation: {
      kicker: "Uebersetzung",
      heading: "Auch Volltext-Uebersetzungen bleiben in Zotero.",
      body: "Das Uebersetzungsfenster richtet sich an schwierige Paper-Seiten mit Diagrammen, Formeln und Tabellen. Die Galerie unten zeigt echte Ausgaben aus dem Repository, keine Marketing-Mockups.",
      captions: [
        "Architektur-Seite",
        "Formellastige Seite",
        "Tabellen mit Fliesstext",
      ],
      panelAlt: "Panel fuer Volltext-Uebersetzung",
    },
    install: {
      kicker: "Installation",
      heading: "In wenigen Schritten installiert und einsatzbereit.",
      body: "AIdea wird ueber GitHub Releases als `.xpi` verteilt. Herunterladen, in Zotero aus einer Datei installieren und direkt verwenden. Das Projekt ist kostenlos und Open Source.",
      steps: [
        "Die neueste `.xpi` aus GitHub Releases herunterladen.",
        "In Zotero „Add-on aus Datei installieren“ waehlen.",
        "Zotero neu starten und AIdea in der Library oder im PDF-Reader oeffnen.",
      ],
      note: "Implementierung, Fehlermeldungen und Verbesserungen sind direkt ueber das GitHub-Repository zugaenglich.",
    },
    footer: {
      summary:
        "AIdea ist ein kostenloses Open-Source-Zotero-Plugin fuer Forschende, Studierende und Wissensarbeiter, die KI moeglichst nah an der Leseflaeche nutzen moechten.",
      releaseLabel: "Plugin installieren",
      docsLabel: "Dokumentation",
      githubLabel: "GitHub-Repository",
      issuesLabel: "Issues melden",
      licenseLabel: "AGPL-3.0 Lizenz",
      projectTitle: "Projektlinks",
      communityTitle: "Mitwirken",
      communityBody:
        "Releases verfolgen, Probleme melden und die Implementierung direkt im Repository nachvollziehen.",
    },
  },
  fr: {
    locale: "fr",
    title: "AIdea for Zotero",
    description:
      "AIdea est un plugin IA gratuit et open source pour Zotero, concu pour le chat contextualise, la traduction, la prise de notes et l'acces a plusieurs fournisseurs directement dans la bibliotheque et le lecteur PDF.",
    badge: "Gratuit & Open Source",
    hero: {
      eyebrow:
        "Pour celles et ceux qui lisent des articles, annotent et synthetisent",
      heading: "Lire, questionner et organiser ses notes dans Zotero.",
      subheading:
        "AIdea est un projet gratuit et open source. Il regroupe dans Zotero le chat, l'ancrage sur des passages, la traduction integrale, l'acces a plusieurs modeles et la memoire locale afin de garder le flux de recherche au meme endroit.",
      primaryCta: "Installer depuis Releases",
      secondaryCta: "Voir le code source",
      tertiaryCta: "Lire la documentation",
      metrics: [
        { label: "Prix", value: "Gratuit & ouvert" },
        { label: "Stockage", value: "Local-first" },
        { label: "Interfaces", value: "Library + PDF" },
      ],
    },
    nav: {
      story: "Usages",
      features: "Fonctions",
      install: "Installation",
      github: "GitHub",
    },
    trust: {
      kicker: "Open Source",
      heading: "Un plugin concu pour un usage de recherche durable.",
      items: [
        {
          title: "Gratuit, ouvert et verifiable",
          body: "Le code, la documentation et les versions publiees sont disponibles dans un depot public, ce qui facilite l'installation, la verification et l'amelioration continue.",
        },
        {
          title: "Pense pour le flux de lecture",
          body: "Questions, syntheses, traductions et export de notes restent dans le panneau lateral de Zotero au lieu de passer par des onglets externes.",
        },
        {
          title: "Donnees et memoire d'abord en local",
          body: "L'historique, la memoire et l'etat d'authentification sont stockes en priorite en local. Le projet n'est pas construit autour de la collecte de donnees plateforme.",
        },
      ],
    },
    story: {
      kicker: "Usages",
      heading:
        "Concu pour les vrais gestes de lecture, d'extrait et d'organisation.",
      body: "AIdea s'adresse aux personnes qui lisent attentivement, extraient des passages, comparent des sources et maintiennent leurs notes au fil du travail. On pose la question dans le panneau lateral, on joint un passage PDF comme contexte, on renvoie le resultat dans les notes et on peut poursuivre avec une traduction integrale.",
      bullets: [
        "Le meme panneau lateral fonctionne dans la bibliotheque et dans le lecteur PDF.",
        "Le texte selectionne dans le PDF peut devenir un contexte explicite pour garder la reponse proche de la source.",
        "Les sorties utiles peuvent etre enregistrees dans Zotero au lieu de disparaitre dans un chat temporaire.",
      ],
      panelLabel: "Flux lateral",
      panelCaption:
        "Poser une question, rattacher le contexte et garder les notes liees a l'item courant.",
      secondaryPanelLabel: "Modeles et fournisseurs",
      secondaryPanelCaption:
        "Connexion, changement de modele et configuration d'endpoints compatibles au meme endroit.",
    },
    featureSection: {
      kicker: "Taches courantes",
      heading:
        "Couvre les taches qui reviennent le plus souvent pendant la lecture d'articles.",
      body: "AIdea se concentre sur les parties du flux auxquelles les utilisateurs de Zotero reviennent sans cesse : poser une question sur le texte source, changer de modele, traduire un article entier et enregistrer les sorties utiles dans les notes.",
      cards: [
        {
          title: "Commencer vite, regler ensuite",
          body: "OpenAI, Gemini et GitHub Copilot peuvent etre utilises via OAuth, puis des API compatibles peuvent etre ajoutees si davantage de controle est necessaire.",
          meta: "Demarrage rapide",
        },
        {
          title: "Interroger le texte source",
          body: "Les passages PDF selectionnes peuvent etre ajoutes directement au contexte afin que les reponses restent ancrees dans le document.",
          meta: "Rester proche de la source",
        },
        {
          title: "Poursuivre jusqu'a la traduction integrale",
          body: "Des PDF bilingues ou monolingues peuvent etre exportes lorsque la tache devient la lecture complete d'un article.",
          meta: "Utile pour les articles longs",
        },
        {
          title: "Acces a plusieurs fournisseurs",
          body: "En plus des fournisseurs integres, il est possible de connecter Ollama, LM Studio, OpenRouter et d'autres endpoints compatibles.",
          meta: "Garder le choix",
        },
        {
          title: "Historique et memoire locaux",
          body: "Les conversations et la memoire longue duree restent dans la base locale de Zotero, ce qui convient mieux aux projets suivis sur plusieurs semaines.",
          meta: "Bon pour la continuite",
        },
        {
          title: "Renvoyer les sorties utiles dans Zotero",
          body: "Markdown, blocs de code, tableaux et LaTeX peuvent etre reinjectes dans Zotero en preservant au mieux leur structure.",
          meta: "Conserver le resultat",
        },
      ],
    },
    translation: {
      kicker: "Traduction",
      heading: "La traduction integrale peut rester dans Zotero.",
      body: "Le panneau de traduction vise les pages les plus difficiles des articles scientifiques : schemas, formules et tableaux. La galerie ci-dessous montre de vraies sorties deja presentes dans le depot.",
      captions: [
        "Page d'architecture",
        "Page riche en formules",
        "Tableaux melanges au texte",
      ],
      panelAlt: "Panneau de traduction integrale",
    },
    install: {
      kicker: "Installation",
      heading: "Quelques etapes suffisent pour commencer.",
      body: "AIdea est distribue via GitHub Releases au format `.xpi`. Il suffit de le telecharger, de l'installer depuis un fichier dans Zotero et de commencer a l'utiliser. Le projet est gratuit et open source.",
      steps: [
        "Telecharger le dernier `.xpi` depuis GitHub Releases.",
        "Choisir « Installer un module depuis un fichier » dans l'interface des modules de Zotero.",
        "Redemarrer Zotero puis ouvrir AIdea depuis la bibliotheque ou le lecteur PDF.",
      ],
      note: "Le depot GitHub permet de consulter l'implementation, signaler un probleme et contribuer a l'amelioration du projet.",
    },
    footer: {
      summary:
        "AIdea est un plugin Zotero gratuit et open source pour les chercheurs, etudiants et travailleurs du savoir qui veulent garder l'assistance IA au plus pres de la surface de lecture.",
      releaseLabel: "Installer le plugin",
      docsLabel: "Documentation",
      githubLabel: "Depot GitHub",
      issuesLabel: "Signaler un probleme",
      licenseLabel: "Licence AGPL-3.0",
      projectTitle: "Liens du projet",
      communityTitle: "Contribuer",
      communityBody:
        "Suivez les releases, remontez les problemes et examinez l'implementation directement dans le depot.",
    },
  },
  "zh-TW": {
    locale: "zh-TW",
    title: "AIdea for Zotero",
    description:
      "AIdea 是一個免費開源的 Zotero AI 外掛，幫助研究者在文獻庫與 PDF 閱讀器中完成問答、翻譯、筆記整理與多模型接入。",
    badge: "免費開源 Zotero 外掛",
    hero: {
      eyebrow: "給長期讀論文、做筆記、寫綜述的人",
      heading: "在 Zotero 裡讀論文、提問和整理筆記。",
      subheading:
        "AIdea 是一個免費開源專案。它把對話、選段理解、全文翻譯、多模型接入與本地記憶放進 Zotero，讓你在閱讀論文和整理資料時盡量少切換網頁、少丟失上下文。",
      primaryCta: "安裝外掛",
      secondaryCta: "查看原始碼",
      tertiaryCta: "閱讀文件",
      metrics: [
        { label: "價格", value: "免費開源" },
        { label: "儲存方式", value: "本地優先" },
        { label: "使用介面", value: "資料庫 + PDF 閱讀器" },
      ],
    },
    nav: {
      story: "適用場景",
      features: "主要能力",
      install: "如何安裝",
      github: "GitHub",
    },
    trust: {
      kicker: "開源專案",
      heading: "一個適合長期使用的研究外掛。",
      items: [
        {
          title: "免費開源，可直接查看原始碼",
          body: "外掛程式碼、文件與發布版本都在公開倉庫中，適合自行安裝、檢查、回報與持續改進。",
        },
        {
          title: "盡量不打斷論文閱讀流程",
          body: "提問、總結、解釋、翻譯與筆記整理都留在 Zotero 側欄，不需要在多個網頁之間來回切換。",
        },
        {
          title: "資料與記憶本地優先",
          body: "聊天記錄、記憶與授權狀態優先保存在本地，外掛本身不做平台式使用者資料蒐集。",
        },
      ],
    },
    story: {
      kicker: "適用場景",
      heading: "圍繞閱讀、摘錄與整理的實際流程設計。",
      body: "AIdea 面向的是正在閱讀、摘錄、比對與整理論文的人。你可以在 Zotero 側欄裡提問，把 PDF 選段直接帶進上下文，把結果寫回筆記，必要時再繼續做全文翻譯。",
      bullets: [
        "同一套側欄在資料庫檢視和 PDF 閱讀器裡都可使用。",
        "選段可直接進入上下文，讓回答更貼近原文而不是泛泛總結。",
        "有用的結果可以持續沉澱到 Zotero 筆記裡，而不是停在一次性聊天記錄中。",
      ],
      panelLabel: "側欄問答",
      panelCaption: "圍繞目前條目與論文正文繼續提問、整理和記錄。",
      secondaryPanelLabel: "模型與提供商",
      secondaryPanelCaption:
        "登入、切換模型與設定相容介面都在同一個面板中完成。",
    },
    featureSection: {
      kicker: "主要能力",
      heading: "涵蓋論文閱讀中最常見的任務。",
      body: "AIdea 主要覆蓋 Zotero 使用者最常回到的幾類任務：圍繞原文提問、切換模型、全文翻譯，以及把結果沉澱回筆記。",
      cards: [
        {
          title: "先用起來，再慢慢調整設定",
          body: "OpenAI、Gemini、GitHub Copilot 可透過 OAuth 登入，也可以接入相容 API，降低第一次上手的折騰。",
          meta: "先用起來",
        },
        {
          title: "圍繞原文提問",
          body: "PDF 選段可以明確加入上下文，讓回答盡量貼近論文具體段落，而不是脫離原文泛泛總結。",
          meta: "更貼近論文",
        },
        {
          title: "需要整篇翻譯時也能繼續做",
          body: "支援雙語或單語 PDF 輸出，適合需要通讀外文論文並保留版面結構的場景。",
          meta: "適合長文",
        },
        {
          title: "多模型入口",
          body: "除了官方提供商外，也可連接 Ollama、LM Studio、OpenRouter 等相容端點，保留模型選擇自由。",
          meta: "保留選擇自由",
        },
        {
          title: "本地聊天與記憶",
          body: "聊天記錄與長期記憶保存在 Zotero 本地資料庫中，更適合持續幾週或幾個月的研究專案。",
          meta: "適合長期累積",
        },
        {
          title: "把結果沉澱回 Zotero",
          body: "Markdown、程式碼區塊、表格與 LaTeX 數學公式都能較完整地回寫到 Zotero 筆記中。",
          meta: "結果能留下來",
        },
      ],
    },
    translation: {
      kicker: "全文翻譯",
      heading: "整篇翻譯也能留在 Zotero 內完成。",
      body: "翻譯面板面向論文中的真實頁面，包括結構圖、公式與表格。這裡展示的是倉庫裡已有的實際輸出截圖，不是行銷示意圖。",
      captions: ["架構圖頁面", "公式密集頁面", "表格與正文混排"],
      panelAlt: "全文翻譯面板",
    },
    install: {
      kicker: "安裝方式",
      heading: "幾步安裝，直接開始使用。",
      body: "AIdea 透過 GitHub Releases 分發 `.xpi` 安裝包。下載後在 Zotero 中從檔案安裝即可使用，整個專案免費開源。",
      steps: [
        "從 GitHub Releases 下載最新 `.xpi` 檔案。",
        "在 Zotero 的附加元件介面中選擇「從檔案安裝」。",
        "重新啟動 Zotero 後，在 Library 或 PDF Reader 側欄中啟用 AIdea。",
      ],
      note: "如果你想了解實作方式、回報問題或參與改進，可以直接在 GitHub 倉庫查看原始碼、Issue 與發布記錄。",
    },
    footer: {
      summary:
        "AIdea 是一個免費開源的 Zotero 外掛，服務對象是希望在論文閱讀現場使用 AI 的研究者、學生與知識工作者。",
      releaseLabel: "安裝外掛",
      docsLabel: "專案文件",
      githubLabel: "GitHub 倉庫",
      issuesLabel: "問題回報",
      licenseLabel: "AGPL-3.0 授權",
      projectTitle: "專案入口",
      communityTitle: "參與改進",
      communityBody:
        "歡迎透過 Issue 回報問題、查看發布記錄，或直接在倉庫中了解實作細節。",
    },
  },
  ko: {
    locale: "ko",
    title: "AIdea for Zotero",
    description:
      "AIdea는 Zotero 라이브러리와 PDF 리더 안에서 논문 기반 대화, 번역, 노트 정리, 여러 모델 제공자 연결을 지원하는 무료 오픈소스 AI 플러그인입니다.",
    badge: "무료 오픈소스",
    hero: {
      eyebrow: "논문을 읽고, 메모하고, 리뷰를 쓰는 사람들을 위해",
      heading: "Zotero 안에서 읽고, 묻고, 노트를 정리하세요.",
      subheading:
        "AIdea는 무료 오픈소스 프로젝트입니다. 대화, 문맥에 붙는 질문, 전체 문서 번역, 여러 제공자 연결, 로컬 메모리를 Zotero 안에 모아 두어 브라우저 탭을 오가며 흐름이 끊기지 않도록 돕습니다.",
      primaryCta: "Releases에서 설치",
      secondaryCta: "소스 코드 보기",
      tertiaryCta: "문서 읽기",
      metrics: [
        { label: "가격", value: "무료 오픈소스" },
        { label: "저장 방식", value: "로컬 우선" },
        { label: "사용 위치", value: "라이브러리 + PDF" },
      ],
    },
    nav: {
      story: "활용 장면",
      features: "주요 기능",
      install: "설치 방법",
      github: "GitHub",
    },
    trust: {
      kicker: "오픈소스 프로젝트",
      heading: "오랫동안 쓰기 좋은 연구 플러그인.",
      items: [
        {
          title: "무료이고 공개되어 바로 확인 가능",
          body: "코드, 문서, 릴리스가 모두 공개 저장소에 있어 직접 설치하고 검토하고 이슈를 남기며 계속 개선할 수 있습니다.",
        },
        {
          title: "읽는 흐름을 최대한 끊지 않음",
          body: "질문, 요약, 번역, 노트 정리가 Zotero 사이드 패널 안에 남아 있어 외부 채팅 탭을 오갈 필요가 없습니다.",
        },
        {
          title: "데이터와 메모리는 로컬 우선",
          body: "대화 기록, 메모리, 인증 상태는 우선 로컬에 저장되며 플랫폼형 사용자 데이터 수집을 전제로 하지 않습니다.",
        },
      ],
    },
    story: {
      kicker: "활용 장면",
      heading: "읽기, 발췌, 정리의 실제 흐름에 맞춰 설계했습니다.",
      body: "AIdea는 논문을 읽고, 필요한 부분을 발췌하고, 자료를 비교하며 노트를 쌓아 가는 사람을 위한 도구입니다. 사이드 패널에서 질문하고, PDF 구절을 그대로 문맥에 넣고, 유용한 결과를 노트로 돌려보내고, 필요하면 전체 문서 번역으로 이어갈 수 있습니다.",
      bullets: [
        "같은 사이드 패널이 라이브러리 보기와 PDF 리더 양쪽에서 동작합니다.",
        "선택한 PDF 텍스트를 직접 문맥에 넣어 답변이 원문에 더 가깝게 유지됩니다.",
        "유용한 출력은 일회성 채팅 기록에 머물지 않고 Zotero로 다시 저장할 수 있습니다.",
      ],
      panelLabel: "사이드 패널 흐름",
      panelCaption:
        "현재 항목에 연결된 상태로 질문하고, 문맥을 붙이고, 노트를 남깁니다.",
      secondaryPanelLabel: "모델과 제공자",
      secondaryPanelCaption:
        "로그인, 모델 전환, 호환 엔드포인트 설정을 한곳에서 처리합니다.",
    },
    featureSection: {
      kicker: "주요 기능",
      heading: "논문을 읽을 때 자주 마주치는 작업을 다룹니다.",
      body: "AIdea는 Zotero 사용자가 반복해서 하게 되는 핵심 흐름에 집중합니다. 원문 기반 질문, 모델 전환, 논문 전체 번역, 그리고 유용한 결과를 노트에 남기는 작업입니다.",
      cards: [
        {
          title: "복잡한 설정 전에 먼저 써볼 수 있음",
          body: "OpenAI, Gemini, GitHub Copilot은 OAuth로 바로 시작할 수 있고, 더 많은 제어가 필요할 때 호환 API를 추가할 수 있습니다.",
          meta: "빠르게 시작",
        },
        {
          title: "논문 본문을 기준으로 질문",
          body: "선택한 PDF 구절을 직접 문맥에 붙여 답변이 원문에서 멀어지지 않도록 돕습니다.",
          meta: "원문에 밀착",
        },
        {
          title: "전체 번역이 필요해져도 계속 이어짐",
          body: "레이아웃을 유지한 이중 언어 또는 단일 언어 PDF를 내보낼 수 있어 긴 논문을 끝까지 읽는 데 유용합니다.",
          meta: "긴 문서에 적합",
        },
        {
          title: "여러 제공자 연결",
          body: "내장 제공자 외에도 Ollama, LM Studio, OpenRouter 등 호환 엔드포인트를 연결할 수 있습니다.",
          meta: "선택권 유지",
        },
        {
          title: "로컬 대화 기록과 메모리",
          body: "대화와 장기 메모리가 Zotero의 로컬 데이터베이스에 남아 장기 연구 프로젝트와 잘 맞습니다.",
          meta: "지속적인 연구에 적합",
        },
        {
          title: "유용한 결과를 Zotero로 다시 저장",
          body: "Markdown, 코드 블록, 표, LaTeX 수식을 구조를 최대한 유지한 채 Zotero로 되돌릴 수 있습니다.",
          meta: "결과를 남김",
        },
      ],
    },
    translation: {
      kicker: "전체 번역",
      heading: "논문 전체 번역도 Zotero 안에서 이어갈 수 있습니다.",
      body: "번역 패널은 도표, 수식, 표처럼 학술 논문에서 특히 까다로운 페이지를 염두에 두고 있습니다. 아래 갤러리는 저장소에 이미 있는 실제 출력 예시입니다.",
      captions: [
        "구조도 페이지",
        "수식이 많은 페이지",
        "표와 본문이 섞인 페이지",
      ],
      panelAlt: "전체 번역 패널",
    },
    install: {
      kicker: "설치 방법",
      heading: "몇 단계만으로 바로 사용할 수 있습니다.",
      body: "AIdea는 GitHub Releases를 통해 `.xpi`로 배포됩니다. 파일을 내려받아 Zotero에서 설치하면 바로 사용할 수 있습니다. 프로젝트는 무료 오픈소스입니다.",
      steps: [
        "GitHub Releases에서 최신 `.xpi` 파일을 다운로드합니다.",
        "Zotero의 부가 기능 화면에서 '파일에서 설치'를 선택합니다.",
        "Zotero를 다시 시작한 뒤 라이브러리나 PDF 리더에서 AIdea를 엽니다.",
      ],
      note: "구현을 확인하거나 문제를 제보하거나 개선에 참여하고 싶다면 GitHub 저장소에서 코드, 이슈, 릴리스를 바로 확인할 수 있습니다.",
    },
    footer: {
      summary:
        "AIdea는 논문을 읽는 자리 가까이에서 AI를 쓰고 싶은 연구자, 학생, 지식 노동자를 위한 무료 오픈소스 Zotero 플러그인입니다.",
      releaseLabel: "플러그인 설치",
      docsLabel: "문서",
      githubLabel: "GitHub 저장소",
      issuesLabel: "문제 제보",
      licenseLabel: "AGPL-3.0 라이선스",
      projectTitle: "프로젝트 링크",
      communityTitle: "기여하기",
      communityBody:
        "릴리스를 확인하고 문제를 제보하며 구현을 직접 살펴볼 수 있습니다.",
    },
  },
  es: {
    locale: "es",
    title: "AIdea for Zotero",
    description:
      "AIdea es un complemento de IA gratuito y de código abierto para Zotero que permite chatear sobre artículos, traducir, organizar notas y conectar varios proveedores dentro de la biblioteca y del lector PDF.",
    badge: "Gratis y de código abierto",
    hero: {
      eyebrow: "Para quienes leen artículos, toman notas y escriben revisiones",
      heading: "Lee, pregunta y organiza tus notas dentro de Zotero.",
      subheading:
        "AIdea es un proyecto gratuito y de código abierto. Mantiene el chat, el anclaje a pasajes, la traducción completa, el acceso a varios proveedores y la memoria local dentro de Zotero para que no tengas que ir saltando entre pestañas del navegador.",
      primaryCta: "Instalar desde Releases",
      secondaryCta: "Ver el código",
      tertiaryCta: "Leer la documentación",
      metrics: [
        { label: "Precio", value: "Gratis y abierto" },
        { label: "Almacenamiento", value: "Local primero" },
        { label: "Superficie", value: "Biblioteca + PDF" },
      ],
    },
    nav: {
      story: "Casos de uso",
      features: "Funciones",
      install: "Instalación",
      github: "GitHub",
    },
    trust: {
      kicker: "Código abierto",
      heading: "Un complemento de investigación pensado para el uso continuo.",
      items: [
        {
          title: "Gratis, abierto y fácil de inspeccionar",
          body: "El código, la documentación y las versiones publicadas viven en un repositorio público para que cualquiera pueda instalarlo, revisarlo, reportar problemas y mejorarlo con el tiempo.",
        },
        {
          title: "Diseñado para no romper el flujo de lectura",
          body: "Preguntar, resumir, traducir y exportar notas sucede dentro del panel lateral de Zotero en lugar de depender de pestañas externas.",
        },
        {
          title: "Datos y memoria, primero en local",
          body: "El historial, la memoria y el estado de autenticación se guardan primero en local; el proyecto no gira alrededor de recolectar datos de usuarios.",
        },
      ],
    },
    story: {
      kicker: "Casos de uso",
      heading: "Pensado para el trabajo real de leer, extraer y organizar.",
      body: "AIdea está hecho para quienes leen con atención, extraen pasajes, comparan fuentes y mantienen notas mientras avanzan. Puedes preguntar en el panel lateral, adjuntar fragmentos exactos del PDF, devolver resultados útiles a tus notas y pasar a la traducción completa cuando haga falta.",
      bullets: [
        "El mismo panel lateral funciona tanto en la biblioteca como en el lector PDF.",
        "El texto seleccionado del PDF puede entrar directamente en el contexto para que la respuesta se mantenga cerca de la fuente.",
        "Los resultados útiles pueden guardarse de nuevo en Zotero en lugar de perderse en un chat temporal.",
      ],
      panelLabel: "Flujo en panel lateral",
      panelCaption:
        "Pregunta, añade contexto y conserva las notas ligadas al elemento actual.",
      secondaryPanelLabel: "Modelos y proveedores",
      secondaryPanelCaption:
        "Inicia sesión, cambia de modelo o configura endpoints compatibles en un solo lugar.",
    },
    featureSection: {
      kicker: "Tareas comunes",
      heading: "Cubre las tareas que más se repiten al leer artículos.",
      body: "AIdea se centra en la parte del flujo a la que los usuarios de Zotero vuelven una y otra vez: preguntar sobre el texto fuente, cambiar de modelo, traducir artículos completos y guardar resultados útiles en las notas.",
      cards: [
        {
          title: "Empieza a usarlo antes de una configuración pesada",
          body: "OpenAI, Gemini y GitHub Copilot pueden utilizarse mediante OAuth, y se pueden agregar API compatibles cuando necesites más control.",
          meta: "Inicio rápido",
        },
        {
          title: "Pregunta sobre el propio artículo",
          body: "Los pasajes seleccionados del PDF pueden adjuntarse directamente al contexto para que la respuesta no se aparte del texto original.",
          meta: "Cerca del texto",
        },
        {
          title: "Sigue cuando la tarea pasa a ser traducción completa",
          body: "Puedes exportar PDF bilingües o monolingües cuando necesites leer un artículo entero sin perder la estructura de la maquetación.",
          meta: "Útil para textos largos",
        },
        {
          title: "Conexión con varios proveedores",
          body: "Además de los proveedores integrados, se pueden conectar Ollama, LM Studio, OpenRouter y otros endpoints compatibles.",
          meta: "Mantener la libertad de elegir",
        },
        {
          title: "Historial y memoria locales",
          body: "Las conversaciones y la memoria de largo plazo permanecen en la base de datos local de Zotero, algo más adecuado para proyectos de investigación prolongados.",
          meta: "Mejor para la continuidad",
        },
        {
          title: "Guarda la salida útil en Zotero",
          body: "Markdown, bloques de código, tablas y fórmulas LaTeX pueden volver a Zotero conservando gran parte de su estructura.",
          meta: "Conservar resultados",
        },
      ],
    },
    translation: {
      kicker: "Traducción",
      heading:
        "La traducción completa también puede quedarse dentro de Zotero.",
      body: "El panel de traducción está pensado para las páginas realmente difíciles de los artículos académicos, incluidas diagramas, fórmulas y tablas. La galería inferior muestra salidas reales del repositorio.",
      captions: [
        "Página de arquitectura",
        "Página cargada de fórmulas",
        "Tablas mezcladas con texto",
      ],
      panelAlt: "Panel de traducción completa",
    },
    install: {
      kicker: "Instalación",
      heading: "Bastan unos pocos pasos para empezar.",
      body: "AIdea se distribuye como archivo `.xpi` a través de GitHub Releases. Descárgalo, instálalo desde archivo en Zotero y empieza a usarlo. El proyecto es gratuito y de código abierto.",
      steps: [
        "Descarga el archivo `.xpi` más reciente desde GitHub Releases.",
        "Elige 'Instalar complemento desde archivo' en la interfaz de complementos de Zotero.",
        "Reinicia Zotero y abre AIdea desde la biblioteca o el lector PDF.",
      ],
      note: "Si quieres revisar la implementación, reportar un problema o contribuir, puedes hacerlo directamente desde el repositorio en GitHub.",
    },
    footer: {
      summary:
        "AIdea es un complemento gratuito y de código abierto para Zotero dirigido a investigadores, estudiantes y profesionales del conocimiento que quieren usar IA cerca de la superficie de lectura.",
      releaseLabel: "Instalar complemento",
      docsLabel: "Documentación",
      githubLabel: "Repositorio en GitHub",
      issuesLabel: "Reportar problema",
      licenseLabel: "Licencia AGPL-3.0",
      projectTitle: "Enlaces del proyecto",
      communityTitle: "Contribuir",
      communityBody:
        "Sigue las releases, reporta problemas y revisa la implementación directamente en el repositorio.",
    },
  },
  ru: {
    locale: "ru",
    title: "AIdea for Zotero",
    description:
      "AIdea — это бесплатный плагин ИИ с открытым исходным кодом для Zotero, который позволяет вести диалог по статьям, переводить, организовывать заметки и подключать разных провайдеров прямо в библиотеке и PDF-ридере.",
    badge: "Бесплатно и с открытым кодом",
    hero: {
      eyebrow: "Для тех, кто читает статьи, делает заметки и пишет обзоры",
      heading: "Читайте статьи, задавайте вопросы и ведите заметки в Zotero.",
      subheading:
        "AIdea — это бесплатный проект с открытым исходным кодом. Он оставляет чат, привязку к фрагментам, полный перевод документа, доступ к разным провайдерам и локальную память внутри Zotero, чтобы не приходилось постоянно переключаться между вкладками браузера.",
      primaryCta: "Установить из Releases",
      secondaryCta: "Посмотреть код",
      tertiaryCta: "Читать документацию",
      metrics: [
        { label: "Стоимость", value: "Бесплатно и открыто" },
        { label: "Хранение", value: "Сначала локально" },
        { label: "Где работает", value: "Библиотека + PDF" },
      ],
    },
    nav: {
      story: "Сценарии",
      features: "Возможности",
      install: "Установка",
      github: "GitHub",
    },
    trust: {
      kicker: "Открытый код",
      heading: "Исследовательский плагин для длительной работы.",
      items: [
        {
          title: "Бесплатный, открытый и легко проверяемый",
          body: "Код, документация и релизы находятся в публичном репозитории, поэтому плагин можно установить, проверить, сообщить о проблеме и постепенно улучшать.",
        },
        {
          title: "Не ломает поток чтения",
          body: "Вопросы, сводки, перевод и экспорт заметок остаются в боковой панели Zotero вместо внешних вкладок и чатов.",
        },
        {
          title: "Данные и память прежде всего локально",
          body: "История чатов, память и состояние авторизации сначала сохраняются локально; проект не построен вокруг сбора пользовательских данных.",
        },
      ],
    },
    story: {
      kicker: "Сценарии",
      heading:
        "Спроектирован под реальный процесс чтения, выписок и организации материалов.",
      body: "AIdea рассчитан на тех, кто внимательно читает статьи, выделяет фрагменты, сравнивает источники и параллельно ведет заметки. Можно задавать вопросы в боковой панели, прикреплять точные фрагменты PDF, возвращать полезные результаты в заметки и при необходимости переходить к переводу всей статьи.",
      bullets: [
        "Одна и та же боковая панель работает и в библиотеке, и в PDF-ридере.",
        "Выделенный текст PDF можно напрямую добавлять в контекст, чтобы ответы оставались ближе к источнику.",
        "Полезные результаты можно сохранять обратно в Zotero, а не терять в разовом чате.",
      ],
      panelLabel: "Рабочий процесс в боковой панели",
      panelCaption:
        "Задавайте вопросы, прикрепляйте контекст и сохраняйте заметки рядом с текущим источником.",
      secondaryPanelLabel: "Модели и провайдеры",
      secondaryPanelCaption:
        "Вход, переключение моделей и настройка совместимых эндпоинтов в одном месте.",
    },
    featureSection: {
      kicker: "Типовые задачи",
      heading:
        "Закрывает задачи, которые чаще всего возникают при чтении статей.",
      body: "AIdea сосредоточен на частях рабочего процесса, к которым пользователи Zotero возвращаются постоянно: вопросы по исходному тексту, переключение моделей, перевод всей статьи и сохранение полезного вывода в заметки.",
      cards: [
        {
          title: "Можно начать до сложной настройки",
          body: "OpenAI, Gemini и GitHub Copilot работают через OAuth, а совместимые API можно добавить позже, когда понадобится больше контроля.",
          meta: "Быстрый старт",
        },
        {
          title: "Вопросы по самому тексту статьи",
          body: "Выделенные фрагменты PDF можно прикреплять прямо в контекст, чтобы ответы не уходили в сторону от исходного текста.",
          meta: "Ближе к источнику",
        },
        {
          title: "Можно продолжить, когда задача превращается в полный перевод",
          body: "Поддерживается экспорт двуязычных и одноязычных PDF, если нужно читать статью целиком и сохранить верстку.",
          meta: "Полезно для длинных текстов",
        },
        {
          title: "Подключение разных провайдеров",
          body: "Помимо встроенных провайдеров можно подключать Ollama, LM Studio, OpenRouter и другие совместимые эндпоинты.",
          meta: "Сохраняет свободу выбора",
        },
        {
          title: "Локальная история и память",
          body: "Диалоги и долговременная память остаются в локальной базе Zotero, что лучше подходит для длительных исследовательских проектов.",
          meta: "Подходит для длительной работы",
        },
        {
          title: "Возвращайте полезные результаты в Zotero",
          body: "Markdown, блоки кода, таблицы и формулы LaTeX можно записывать обратно в Zotero с сохранением значительной части структуры.",
          meta: "Сохраняет результат",
        },
      ],
    },
    translation: {
      kicker: "Перевод",
      heading: "Полный перевод статьи тоже может оставаться внутри Zotero.",
      body: "Панель перевода рассчитана на действительно сложные страницы научных статей: схемы, формулы и таблицы. Галерея ниже показывает реальные результаты из репозитория.",
      captions: [
        "Страница со схемой",
        "Страница с большим количеством формул",
        "Таблицы вперемешку с текстом",
      ],
      panelAlt: "Панель полного перевода",
    },
    install: {
      kicker: "Установка",
      heading: "Несколько шагов — и можно начинать работу.",
      body: "AIdea распространяется через GitHub Releases в виде файла `.xpi`. Скачайте его, установите из файла в Zotero и сразу начинайте пользоваться. Проект бесплатный и с открытым кодом.",
      steps: [
        "Скачайте последний файл `.xpi` из GitHub Releases.",
        "В интерфейсе дополнений Zotero выберите «Установить дополнение из файла».",
        "Перезапустите Zotero и откройте AIdea из библиотеки или PDF-ридера.",
      ],
      note: "Если хотите изучить реализацию, сообщить о проблеме или помочь проекту, всё это можно сделать прямо в репозитории GitHub.",
    },
    footer: {
      summary:
        "AIdea — это бесплатный плагин Zotero с открытым кодом для исследователей, студентов и специалистов по знаниям, которые хотят использовать ИИ рядом с поверхностью чтения.",
      releaseLabel: "Установить плагин",
      docsLabel: "Документация",
      githubLabel: "Репозиторий GitHub",
      issuesLabel: "Сообщить о проблеме",
      licenseLabel: "Лицензия AGPL-3.0",
      projectTitle: "Ссылки проекта",
      communityTitle: "Участвовать",
      communityBody:
        "Следите за релизами, сообщайте о проблемах и смотрите реализацию прямо в репозитории.",
    },
  },
  pt: {
    locale: "pt",
    title: "AIdea for Zotero",
    description:
      "AIdea é um plugin de IA gratuito e de código aberto para Zotero, feito para chat contextualizado, tradução, organização de notas e acesso a vários provedores dentro da biblioteca e do leitor de PDF.",
    badge: "Gratuito e de código aberto",
    hero: {
      eyebrow: "Para quem lê artigos, faz anotações e escreve revisões",
      heading: "Leia, pergunte e organize notas dentro do Zotero.",
      subheading:
        "AIdea é um projeto gratuito e de código aberto. Ele mantém chat, ancoragem em trechos, tradução integral, acesso a vários provedores e memória local dentro do Zotero para que o fluxo de pesquisa não se quebre em abas do navegador.",
      primaryCta: "Instalar via Releases",
      secondaryCta: "Ver o código",
      tertiaryCta: "Ler a documentação",
      metrics: [
        { label: "Preço", value: "Gratuito e aberto" },
        { label: "Armazenamento", value: "Local primeiro" },
        { label: "Superfícies", value: "Biblioteca + PDF" },
      ],
    },
    nav: {
      story: "Casos de uso",
      features: "Recursos",
      install: "Instalação",
      github: "GitHub",
    },
    trust: {
      kicker: "Código aberto",
      heading: "Um plugin de pesquisa pensado para uso contínuo.",
      items: [
        {
          title: "Gratuito, aberto e fácil de inspecionar",
          body: "Código, documentação e releases ficam em um repositório público, o que facilita instalar, verificar, relatar problemas e melhorar o projeto ao longo do tempo.",
        },
        {
          title: "Feito para não interromper o fluxo de leitura",
          body: "Perguntas, resumos, tradução e exportação de notas permanecem no painel lateral do Zotero em vez de depender de abas externas.",
        },
        {
          title: "Dados e memória primeiro no local",
          body: "Histórico, memória e estado de autenticação são armazenados primeiro localmente; o projeto não foi construído em torno da coleta de dados de plataforma.",
        },
      ],
    },
    story: {
      kicker: "Casos de uso",
      heading:
        "Projetado para o trabalho real de leitura, extração e organização.",
      body: "AIdea foi feito para quem lê com cuidado, extrai trechos, compara fontes e mantém notas ao longo do processo. Pergunte no painel lateral, anexe passagens exatas do PDF, devolva resultados úteis para as notas e siga para a tradução completa quando necessário.",
      bullets: [
        "O mesmo painel lateral funciona tanto na biblioteca quanto no leitor de PDF.",
        "O texto selecionado no PDF pode entrar diretamente no contexto para manter a resposta próxima da fonte.",
        "Resultados úteis podem ser salvos de volta no Zotero em vez de desaparecerem em um chat temporário.",
      ],
      panelLabel: "Fluxo no painel lateral",
      panelCaption:
        "Pergunte, anexe contexto e mantenha as notas ligadas ao item atual.",
      secondaryPanelLabel: "Modelos e provedores",
      secondaryPanelCaption:
        "Login, troca de modelo e configuração de endpoints compatíveis no mesmo lugar.",
    },
    featureSection: {
      kicker: "Tarefas comuns",
      heading:
        "Cobre as tarefas que aparecem com mais frequência na leitura de artigos.",
      body: "AIdea foca nas partes do fluxo às quais usuários de Zotero sempre retornam: perguntar sobre o texto-fonte, alternar modelos, traduzir artigos completos e salvar saídas úteis de volta nas notas.",
      cards: [
        {
          title: "Comece a usar antes da configuração pesada",
          body: "OpenAI, Gemini e GitHub Copilot podem ser usados via OAuth, e APIs compatíveis podem ser adicionadas quando você quiser mais controle.",
          meta: "Início rápido",
        },
        {
          title: "Pergunte sobre o próprio artigo",
          body: "Trechos selecionados do PDF podem ser anexados diretamente ao contexto para que as respostas permaneçam próximas do texto original.",
          meta: "Perto da fonte",
        },
        {
          title: "Continue quando a tarefa virar tradução completa",
          body: "Exporte PDFs bilíngues ou monolíngues quando precisar ler um artigo inteiro sem perder a estrutura do layout.",
          meta: "Útil para textos longos",
        },
        {
          title: "Conexão com vários provedores",
          body: "Além dos provedores internos, é possível conectar Ollama, LM Studio, OpenRouter e outros endpoints compatíveis.",
          meta: "Manter liberdade de escolha",
        },
        {
          title: "Histórico e memória locais",
          body: "Conversas e memória de longo prazo ficam no banco de dados local do Zotero, o que combina melhor com projetos de pesquisa contínuos.",
          meta: "Melhor para continuidade",
        },
        {
          title: "Guarde resultados úteis no Zotero",
          body: "Markdown, blocos de código, tabelas e fórmulas LaTeX podem voltar ao Zotero preservando boa parte da estrutura.",
          meta: "Conservar resultados",
        },
      ],
    },
    translation: {
      kicker: "Tradução",
      heading: "A tradução integral também pode permanecer dentro do Zotero.",
      body: "O painel de tradução mira nas páginas realmente difíceis de artigos académicos, incluindo diagramas, fórmulas e tabelas. A galeria abaixo mostra saídas reais já presentes no repositório.",
      captions: [
        "Página de arquitetura",
        "Página com muitas fórmulas",
        "Tabelas misturadas ao texto",
      ],
      panelAlt: "Painel de tradução integral",
    },
    install: {
      kicker: "Instalação",
      heading: "Bastam alguns passos para começar.",
      body: "AIdea é distribuído pelo GitHub Releases como arquivo `.xpi`. Basta baixar, instalar a partir de um arquivo no Zotero e começar a usar. O projeto é gratuito e de código aberto.",
      steps: [
        "Baixe o arquivo `.xpi` mais recente em GitHub Releases.",
        "Escolha 'Instalar complemento a partir de arquivo' na interface de complementos do Zotero.",
        "Reinicie o Zotero e abra o AIdea na biblioteca ou no leitor de PDF.",
      ],
      note: "Se quiser revisar a implementação, relatar um problema ou contribuir, tudo isso pode ser feito diretamente no repositório do GitHub.",
    },
    footer: {
      summary:
        "AIdea é um plugin Zotero gratuito e de código aberto para pesquisadores, estudantes e trabalhadores do conhecimento que querem manter a IA perto da superfície de leitura.",
      releaseLabel: "Instalar plugin",
      docsLabel: "Documentação",
      githubLabel: "Repositório GitHub",
      issuesLabel: "Relatar problema",
      licenseLabel: "Licença AGPL-3.0",
      projectTitle: "Links do projeto",
      communityTitle: "Contribuir",
      communityBody:
        "Acompanhe releases, relate problemas e examine a implementação diretamente no repositório.",
    },
  },
  ar: {
    locale: "ar",
    title: "AIdea for Zotero",
    description:
      "AIdea إضافة ذكاء اصطناعي مجانية ومفتوحة المصدر لبرنامج Zotero، تتيح الدردشة المرتبطة بالمقال، والترجمة، وتنظيم الملاحظات، والوصول إلى عدة مزودين داخل المكتبة وقارئ PDF.",
    badge: "مجاني ومفتوح المصدر",
    hero: {
      eyebrow: "لمن يقرؤون الأوراق العلمية ويكتبون الملاحظات والمراجعات",
      heading: "اقرأ واسأل ونظّم ملاحظاتك داخل Zotero.",
      subheading:
        "AIdea مشروع مجاني ومفتوح المصدر. فهو يبقي الدردشة، وربط الإجابات بالمقاطع، وترجمة المستند بالكامل، والوصول إلى عدة مزودين، والذاكرة المحلية داخل Zotero حتى لا يضيع سير العمل بين تبويبات المتصفح.",
      primaryCta: "التثبيت من Releases",
      secondaryCta: "عرض الشفرة المصدرية",
      tertiaryCta: "قراءة التوثيق",
      metrics: [
        { label: "السعر", value: "مجاني ومفتوح" },
        { label: "التخزين", value: "محلي أولاً" },
        { label: "أماكن الاستخدام", value: "المكتبة + PDF" },
      ],
    },
    nav: {
      story: "حالات الاستخدام",
      features: "القدرات",
      install: "التثبيت",
      github: "GitHub",
    },
    trust: {
      kicker: "مفتوح المصدر",
      heading: "إضافة بحثية مناسبة للاستخدام المستمر.",
      items: [
        {
          title: "مجانية ومفتوحة وسهلة الفحص",
          body: "الشفرة والتوثيق والإصدارات موجودة في مستودع عام، لذلك يمكن تثبيتها وفحصها والإبلاغ عن المشاكل وتحسينها مع الوقت.",
        },
        {
          title: "مصممة حتى لا تقطع تدفق القراءة",
          body: "الأسئلة والملخصات والترجمة وتصدير الملاحظات تبقى داخل اللوحة الجانبية في Zotero بدلاً من التنقل بين نوافذ دردشة خارجية.",
        },
        {
          title: "البيانات والذاكرة محلياً أولاً",
          body: "سجل المحادثات والذاكرة وحالة المصادقة تُحفظ محلياً أولاً، والمشروع لا يعتمد على جمع بيانات المستخدمين كمنصة.",
        },
      ],
    },
    story: {
      kicker: "حالات الاستخدام",
      heading: "مصمم لسير العمل الحقيقي في القراءة والاقتباس والتنظيم.",
      body: "AIdea موجه لمن يقرأون بتمعن ويقتبسون المقاطع ويقارنون المصادر ويحافظون على ملاحظاتهم أثناء العمل. يمكنك طرح السؤال من اللوحة الجانبية، وإدخال مقاطع PDF الدقيقة في السياق، وإعادة النتائج المفيدة إلى الملاحظات، ثم الانتقال إلى ترجمة المقال كاملاً عند الحاجة.",
      bullets: [
        "اللوحة الجانبية نفسها تعمل في عرض المكتبة وفي قارئ PDF.",
        "يمكن جعل النص المحدد من PDF جزءاً مباشراً من السياق حتى تبقى الإجابات قريبة من المصدر.",
        "يمكن حفظ النتائج المفيدة مرة أخرى في Zotero بدلاً من ضياعها في محادثة مؤقتة.",
      ],
      panelLabel: "سير العمل في اللوحة الجانبية",
      panelCaption: "اسأل، وأضف السياق، وأبقِ الملاحظات متصلة بالمصدر الحالي.",
      secondaryPanelLabel: "النماذج والمزودون",
      secondaryPanelCaption:
        "تسجيل الدخول وتبديل النماذج وضبط نقاط النهاية المتوافقة في مكان واحد.",
    },
    featureSection: {
      kicker: "المهام الشائعة",
      heading: "يغطي المهام التي تتكرر كثيراً أثناء قراءة الأوراق العلمية.",
      body: "يركز AIdea على الأجزاء التي يعود إليها مستخدمو Zotero باستمرار: السؤال عن النص الأصلي، وتبديل النماذج، وترجمة المقال كاملاً، وحفظ النتائج المفيدة داخل الملاحظات.",
      cards: [
        {
          title: "ابدأ باستخدامه قبل الضبط المعقد",
          body: "يمكن استخدام OpenAI وGemini وGitHub Copilot عبر OAuth، ويمكن إضافة واجهات API المتوافقة لاحقاً عند الحاجة إلى تحكم أكبر.",
          meta: "بداية سريعة",
        },
        {
          title: "اسأل انطلاقاً من المقال نفسه",
          body: "يمكن إرفاق المقاطع المحددة من PDF مباشرة بالسياق حتى تبقى الإجابات مرتبطة بالنص الأصلي.",
          meta: "أقرب إلى المصدر",
        },
        {
          title: "استمر عندما تتحول المهمة إلى ترجمة كاملة",
          body: "يمكن تصدير ملفات PDF ثنائية اللغة أو أحادية اللغة عندما تحتاج إلى قراءة المقال كاملاً مع الحفاظ على بنية التنسيق.",
          meta: "مفيد للمقالات الطويلة",
        },
        {
          title: "اتصال بعدة مزودين",
          body: "إلى جانب المزودين المدمجين، يمكن توصيل Ollama وLM Studio وOpenRouter وغيرها من نقاط النهاية المتوافقة.",
          meta: "الحفاظ على حرية الاختيار",
        },
        {
          title: "سجل محلي وذاكرة محلية",
          body: "المحادثات والذاكرة طويلة المدى تبقى في قاعدة بيانات Zotero المحلية، وهو ما يناسب المشاريع البحثية المستمرة بشكل أفضل.",
          meta: "أفضل للاستمرارية",
        },
        {
          title: "أعد النتائج المفيدة إلى Zotero",
          body: "يمكن إرجاع Markdown وكتل الشفرة والجداول وصيغ LaTeX إلى Zotero مع الحفاظ قدر الإمكان على بنيتها.",
          meta: "الاحتفاظ بالنتائج",
        },
      ],
    },
    translation: {
      kicker: "الترجمة",
      heading: "حتى ترجمة المقال كاملاً يمكن أن تبقى داخل Zotero.",
      body: "لوحة الترجمة موجهة للصفحات الصعبة فعلاً في الأوراق الأكاديمية، بما في ذلك المخططات والصيغ والجداول. المعرض في الأسفل يعرض مخرجات حقيقية موجودة بالفعل في المستودع.",
      captions: ["صفحة مخطط", "صفحة مليئة بالمعادلات", "جداول ممزوجة بالنص"],
      panelAlt: "لوحة الترجمة الكاملة",
    },
    install: {
      kicker: "التثبيت",
      heading: "بضع خطوات فقط للبدء.",
      body: "يتم توزيع AIdea عبر GitHub Releases كملف `.xpi`. قم بتنزيله، وثبّته من ملف داخل Zotero، وابدأ الاستخدام مباشرة. المشروع مجاني ومفتوح المصدر.",
      steps: [
        "نزّل أحدث ملف `.xpi` من GitHub Releases.",
        "اختر 'تثبيت إضافة من ملف' من واجهة إضافات Zotero.",
        "أعد تشغيل Zotero ثم افتح AIdea من المكتبة أو قارئ PDF.",
      ],
      note: "إذا أردت مراجعة التنفيذ أو الإبلاغ عن مشكلة أو المساهمة في التطوير، فيمكنك فعل ذلك مباشرة من مستودع GitHub.",
    },
    footer: {
      summary:
        "AIdea إضافة Zotero مجانية ومفتوحة المصدر للباحثين والطلاب والعاملين في المعرفة الذين يريدون إبقاء الذكاء الاصطناعي قريباً من سطح القراءة.",
      releaseLabel: "تثبيت الإضافة",
      docsLabel: "التوثيق",
      githubLabel: "مستودع GitHub",
      issuesLabel: "الإبلاغ عن مشكلة",
      licenseLabel: "رخصة AGPL-3.0",
      projectTitle: "روابط المشروع",
      communityTitle: "المساهمة",
      communityBody:
        "تابع الإصدارات، وأبلغ عن المشاكل، وافحص التنفيذ مباشرة من المستودع.",
    },
  },
  hi: {
    locale: "hi",
    title: "AIdea for Zotero",
    description:
      "AIdea Zotero के लिए एक मुफ्त और मुक्त-स्रोत AI प्लगइन है, जो आपकी लाइब्रेरी और PDF रीडर के भीतर शोध-पत्र आधारित चैट, अनुवाद, नोट्स व्यवस्थित करना और कई प्रदाताओं तक पहुँच देता है।",
    badge: "मुफ्त और मुक्त-स्रोत",
    hero: {
      eyebrow:
        "उन लोगों के लिए जो शोध-पत्र पढ़ते हैं, नोट्स बनाते हैं और समीक्षाएँ लिखते हैं",
      heading: "Zotero के भीतर पढ़ें, पूछें और नोट्स व्यवस्थित करें।",
      subheading:
        "AIdea एक मुफ्त और मुक्त-स्रोत परियोजना है। यह चैट, चुने हुए अंश पर आधारित उत्तर, पूरे दस्तावेज़ का अनुवाद, कई प्रदाताओं तक पहुँच और स्थानीय मेमोरी को Zotero के भीतर रखता है, ताकि शोध का प्रवाह बार-बार ब्राउज़र टैब में न टूटे।",
      primaryCta: "Releases से इंस्टॉल करें",
      secondaryCta: "सोर्स कोड देखें",
      tertiaryCta: "दस्तावेज़ पढ़ें",
      metrics: [
        { label: "कीमत", value: "मुफ्त और खुला" },
        { label: "संग्रहण", value: "लोकल-फर्स्ट" },
        { label: "उपयोग स्थान", value: "लाइब्रेरी + PDF" },
      ],
    },
    nav: {
      story: "उपयोग के दृश्य",
      features: "मुख्य क्षमताएँ",
      install: "इंस्टॉल करें",
      github: "GitHub",
    },
    trust: {
      kicker: "मुक्त-स्रोत",
      heading: "लंबे समय की शोध-प्रक्रिया के लिए बना प्लगइन।",
      items: [
        {
          title: "मुफ्त, खुला और आसानी से जाँचने योग्य",
          body: "कोड, दस्तावेज़ और रिलीज़ सार्वजनिक रिपॉज़िटरी में हैं, इसलिए इसे इंस्टॉल करना, जाँचना, समस्या बताना और बेहतर बनाना आसान है।",
        },
        {
          title: "पढ़ने का प्रवाह टूटने नहीं देता",
          body: "सवाल, सारांश, अनुवाद और नोट निर्यात सब Zotero के साइड पैनल में रहते हैं, अलग चैट टैब में नहीं।",
        },
        {
          title: "डेटा और मेमोरी लोकल-फर्स्ट",
          body: "चैट इतिहास, मेमोरी और प्रमाणीकरण की स्थिति पहले लोकल रूप से संग्रहीत होती है; यह परियोजना प्लेटफ़ॉर्म-आधारित उपयोगकर्ता डेटा संग्रह पर नहीं बनी है।",
        },
      ],
    },
    story: {
      kicker: "उपयोग के दृश्य",
      heading:
        "पढ़ने, अंश निकालने और व्यवस्थित करने के असली प्रवाह के लिए बना।",
      body: "AIdea उन लोगों के लिए है जो ध्यान से पढ़ते हैं, अंश निकालते हैं, स्रोतों की तुलना करते हैं और साथ-साथ नोट्स सँभालते हैं। साइड पैनल में पूछिए, सटीक PDF अंश को संदर्भ में जोड़िए, उपयोगी परिणामों को नोट्स में वापस भेजिए और ज़रूरत पड़ने पर पूरे दस्तावेज़ के अनुवाद तक जाइए।",
      bullets: [
        "वही साइड पैनल लाइब्रेरी व्यू और PDF रीडर दोनों में काम करता है।",
        "चुना हुआ PDF पाठ सीधे संदर्भ का हिस्सा बन सकता है ताकि जवाब स्रोत के करीब रहे।",
        "उपयोगी परिणाम Zotero में वापस सहेजे जा सकते हैं, वे केवल अस्थायी चैट में नहीं खोते।",
      ],
      panelLabel: "साइड-पैनल कार्यप्रवाह",
      panelCaption:
        "सवाल पूछिए, संदर्भ जोड़िए और मौजूदा आइटम से जुड़े नोट्स बनाए रखिए।",
      secondaryPanelLabel: "मॉडल और प्रदाता",
      secondaryPanelCaption:
        "साइन इन, मॉडल बदलना और संगत एंडपॉइंट की सेटिंग एक ही जगह पर।",
    },
    featureSection: {
      kicker: "मुख्य क्षमताएँ",
      heading: "शोध-पत्र पढ़ते समय बार-बार आने वाले काम सँभालता है।",
      body: "AIdea उन हिस्सों पर ध्यान देता है जहाँ Zotero उपयोगकर्ता सबसे ज़्यादा लौटते हैं: स्रोत-पाठ पर सवाल पूछना, मॉडल बदलना, पूरे शोध-पत्र का अनुवाद करना और उपयोगी परिणामों को नोट्स में सहेजना।",
      cards: [
        {
          title: "भारी सेटअप से पहले भी इस्तेमाल शुरू करें",
          body: "OpenAI, Gemini और GitHub Copilot OAuth के ज़रिए चल सकते हैं, और ज़रूरत पड़ने पर बाद में संगत API जोड़ी जा सकती हैं।",
          meta: "तेज़ शुरुआत",
        },
        {
          title: "शोध-पत्र के पाठ पर आधारित सवाल",
          body: "चुने हुए PDF अंश सीधे संदर्भ में जोड़े जा सकते हैं ताकि जवाब मूल पाठ से दूर न जाए।",
          meta: "स्रोत के करीब",
        },
        {
          title: "काम पूरे अनुवाद में बदल जाए तब भी जारी रखें",
          body: "द्विभाषी या एक-भाषी PDF निर्यात किए जा सकते हैं जब आपको पूरा शोध-पत्र पढ़ना हो और लेआउट बचाए रखना हो।",
          meta: "लंबे पाठ के लिए उपयोगी",
        },
        {
          title: "कई प्रदाताओं तक पहुँच",
          body: "बिल्ट-इन प्रदाताओं के अलावा Ollama, LM Studio, OpenRouter और अन्य संगत एंडपॉइंट भी जोड़े जा सकते हैं।",
          meta: "चयन बनाए रखें",
        },
        {
          title: "लोकल चैट इतिहास और मेमोरी",
          body: "बातचीत और दीर्घकालिक मेमोरी Zotero के लोकल डेटाबेस में रहती है, जो चलती शोध-परियोजनाओं के लिए अधिक उपयुक्त है।",
          meta: "लंबे प्रोजेक्ट के लिए बेहतर",
        },
        {
          title: "उपयोगी परिणाम Zotero में वापस सहेजें",
          body: "Markdown, कोड ब्लॉक, तालिकाएँ और LaTeX गणित को उनकी काफी संरचना के साथ Zotero में वापस लिखा जा सकता है।",
          meta: "नतीजा सँभालें",
        },
      ],
    },
    translation: {
      kicker: "अनुवाद",
      heading: "पूरे शोध-पत्र का अनुवाद भी Zotero के भीतर रह सकता है।",
      body: "अनुवाद पैनल उन अकादमिक पृष्ठों के लिए बना है जो सच में कठिन होते हैं, जैसे डायग्राम, सूत्र और तालिकाएँ। नीचे की गैलरी रिपॉज़िटरी में मौजूद वास्तविक आउटपुट दिखाती है।",
      captions: [
        "आर्किटेक्चर पृष्ठ",
        "सूत्रों से भरा पृष्ठ",
        "पाठ के साथ मिली-जुली तालिकाएँ",
      ],
      panelAlt: "पूर्ण-दस्तावेज़ अनुवाद पैनल",
    },
    install: {
      kicker: "इंस्टॉल करें",
      heading: "कुछ ही चरणों में शुरू करें।",
      body: "AIdea GitHub Releases के ज़रिए `.xpi` के रूप में मिलता है। फ़ाइल डाउनलोड कीजिए, Zotero में फ़ाइल से इंस्टॉल कीजिए और उपयोग शुरू कीजिए। परियोजना मुफ्त और मुक्त-स्रोत है।",
      steps: [
        "GitHub Releases से नवीनतम `.xpi` फ़ाइल डाउनलोड कीजिए।",
        "Zotero के ऐड-ऑन इंटरफ़ेस में 'Install Add-on From File' चुनिए।",
        "Zotero पुनः शुरू करके लाइब्रेरी या PDF रीडर से AIdea खोलिए।",
      ],
      note: "अगर आप कार्यान्वयन देखना, समस्या रिपोर्ट करना या योगदान देना चाहते हैं, तो GitHub रिपॉज़िटरी में कोड, issues और releases सब मिल जाएँगे।",
    },
    footer: {
      summary:
        "AIdea शोधकर्ताओं, छात्रों और ज्ञान-कर्मियों के लिए एक मुफ्त मुक्त-स्रोत Zotero प्लगइन है, जो पढ़ने की सतह के पास ही AI रखना चाहते हैं।",
      releaseLabel: "प्लगइन इंस्टॉल करें",
      docsLabel: "दस्तावेज़",
      githubLabel: "GitHub रिपॉज़िटरी",
      issuesLabel: "समस्या रिपोर्ट करें",
      licenseLabel: "AGPL-3.0 लाइसेंस",
      projectTitle: "परियोजना लिंक",
      communityTitle: "योगदान दें",
      communityBody:
        "Releases देखें, समस्याएँ रिपोर्ट करें और कार्यान्वयन को सीधे रिपॉज़िटरी में देखिए।",
    },
  },
};
