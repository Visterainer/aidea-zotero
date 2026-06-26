import { callLLM } from "../../utils/llmClient";
import { getSelectedProfileForItem } from "../contextPanel/prefHelpers";
import {
  getModelChoices,
  type ModelChoice,
} from "../contextPanel/setupHandlers/controllers/modelSelectionController";
import { providerToMarker, type OAuthProviderId } from "../../utils/oauthCli";
import type {
  AuthorContact,
  AuthorProfileInput,
  AuthorProfileProgressCallback,
  AuthorProfileResult,
  PaperAuthor,
} from "./types";
import type { AuthorProfileCopy } from "./i18n";
import { getAuthorProfileCopy } from "./i18n";
import { getAuthorProfileLanguage, getStringPref, truncateText } from "./utils";

const KNOWN_OAUTH_PROVIDERS = new Set<string>([
  "openai-codex",
  "google-gemini-cli",
  "github-copilot",
]);

type AuthorProfileModelConfig = ReturnType<typeof getSelectedProfileForItem>;

function isOAuthProviderId(
  value: string | undefined,
): value is OAuthProviderId {
  return Boolean(value && KNOWN_OAUTH_PROVIDERS.has(value));
}

function choiceMatchesSavedModel(
  choice: ModelChoice,
  model: string,
  provider: string,
): boolean {
  if (choice.model !== model) return false;
  if (!provider) return true;
  return choice.providerId === provider || choice.provider === provider;
}

function resolveModelConfigFromChoice(
  choice: ModelChoice,
  profiles: ReturnType<typeof getModelChoices>["profiles"],
): AuthorProfileModelConfig | null {
  let apiBase = choice.apiBase || "";
  let apiKey = choice.apiKey || "";
  if (!apiBase && isOAuthProviderId(choice.providerId)) {
    apiBase = providerToMarker(choice.providerId);
  }
  if (!apiBase) {
    const profile = profiles[choice.key];
    apiBase = profile?.apiBase || "";
    apiKey = profile?.apiKey || "";
  }
  const model = choice.model || profiles[choice.key]?.model || "";
  if (!model || !apiBase) return null;
  return {
    key: choice.key,
    apiBase,
    apiKey,
    model,
  };
}

function resolveAuthorProfileModel(
  item: Zotero.Item,
): AuthorProfileModelConfig {
  const fallback = getSelectedProfileForItem(item.id);
  const savedModel = getStringPref("authorProfiles.model").trim();
  if (!savedModel) return fallback;

  const savedProvider = getStringPref("authorProfiles.provider").trim();
  const { profiles, choices } = getModelChoices();
  const choice =
    choices.find((entry) =>
      choiceMatchesSavedModel(entry, savedModel, savedProvider),
    ) || choices.find((entry) => entry.model === savedModel);
  if (!choice) return fallback;

  return resolveModelConfigFromChoice(choice, profiles) || fallback;
}

function buildAuthorFacts(author: PaperAuthor): Record<string, unknown> {
  return {
    name: author.name,
    sequence: author.sequence,
    affiliations: author.affiliations.slice(0, 6),
    emails: author.emails.slice(0, 4),
    orcid: author.orcid,
    openAlexId: author.openAlexId,
    semanticScholarId: author.semanticScholarId,
    isCorresponding: author.isCorresponding || false,
    correspondenceSources: author.correspondenceSources,
    evidence: author.evidence.slice(0, 4),
    metrics: author.metrics,
  };
}

function buildContactFacts(contact: AuthorContact): Record<string, unknown> {
  return {
    name: contact.name,
    email: contact.email,
    affiliation: contact.affiliation,
    source: contact.source,
    evidence: contact.evidence,
  };
}

function isChineseTarget(code: string): boolean {
  return /^zh/i.test(code.trim());
}

function buildStructureInstructions(
  targetLanguage: string,
  copy: AuthorProfileCopy,
): string[] {
  const h = copy.headings;
  const f = copy.fields;
  const localizedStructure = [
    `### ${h.correspondingAuthor}`,
    `- ${f.name}:`,
    `- ${f.affiliation}:`,
    `- ${f.email}:`,
    `- ${f.evidenceConfidence}:`,
    "",
    `### ${h.academicInformation}`,
    `- ${f.paperRelatedTopics}:`,
    `- ${f.publicScholarlyIndicators}:`,
    "",
    `### ${h.relationToPaper}`,
    copy.relationInstruction,
    "",
    `### ${h.sources}`,
    `- ${f.evidence}:`,
    `- ${f.dataSources}:`,
  ];

  if (isChineseTarget(targetLanguage)) {
    return [
      `请严格使用下面的 Markdown 结构和${copy.languageName}字段名：`,
      ...localizedStructure,
      "",
      "中文输出规则：",
      "1. 标题只能使用三级标题 ###，不要使用 ####。",
      `2. 字段名必须全部使用${copy.languageName}，不要输出 Name / Affiliation / Email / Research focus / Public scholarly indicators / Evidence / Databases。`,
      "3. 不要出现 JSON、selectedCorrespondingAuthors、sourceStatus、evidenceSnippets 等内部实现词。",
      `4. 若没有公开学术指标，固定写：${copy.missingMetrics}`,
      `5. ${copy.paperTopicRule}`,
    ];
  }

  return [
    `Use this exact compact Markdown structure with headings and field labels in ${copy.languageName}:`,
    ...localizedStructure,
    "",
    "Formatting rules:",
    "1. Use level-3 headings only (`###`), not level-4 headings.",
    "2. Do not mention JSON or internal keys such as selectedCorrespondingAuthors, sourceStatus, or evidenceSnippets.",
    `3. If public metrics are absent, use this exact missing-information sentence in ${copy.languageName}: ${copy.missingMetrics}`,
    `4. ${copy.paperTopicRule}`,
  ];
}

function buildPrompt(
  input: AuthorProfileInput,
  targetLanguage: string,
): string {
  const copy = getAuthorProfileCopy(targetLanguage);
  const data = {
    paper: {
      title: input.metadata.title,
      doi: input.metadata.doi,
      year: input.metadata.year,
      publicationTitle: input.metadata.publicationTitle,
      abstractNote: truncateText(input.metadata.abstractNote || "", 1200),
    },
    selectedCorrespondingAuthors: input.selectedAuthors.map(buildAuthorFacts),
    correspondingAuthorResolution: input.resolution,
    authorContactCandidates: input.contactAuthors.map(buildContactFacts),
    sourceStatus: input.sourceResults,
    evidenceSnippets: input.localSnippets.slice(0, 8),
  };

  return [
    "You are a strict academic-information editor. Generate a concise corresponding-author profile for a Zotero item from the evidence data below.",
    "",
    `Output language: ${copy.languageName}.`,
    "",
    ...buildStructureInstructions(targetLanguage, copy),
    "",
    "Rules:",
    "1. Use only information present in the evidence data. Do not invent affiliations, roles, topics, citation counts, or h-index values.",
    "2. Keep it concise and academic. Avoid broad article summaries, long caveats, and repeated metadata.",
    "3. If public metrics are absent, write only a short missing-information statement in the target language.",
    "4. If selectedCorrespondingAuthors is empty, state that no explicit corresponding author was identified; do not choose the last author and do not promote any contact email owner to corresponding author.",
    "5. If authorContactCandidates are present while selectedCorrespondingAuthors is empty, list them only as public author contact information, and explicitly distinguish them from corresponding-author evidence.",
    "6. If the author is inferred from last-author position, explicitly mark it as low confidence.",
    "7. Do not mention internal data keys such as selectedCorrespondingAuthors, authorContactCandidates, correspondingAuthorResolution, sourceStatus, or evidenceSnippets.",
    "8. Return Markdown only. No code fences and no preamble.",
    "",
    "Evidence data:",
    JSON.stringify(data, null, 2),
  ].join("\n");
}

function sanitizeMarkdown(value: string, targetLanguage: string): string {
  const copy = getAuthorProfileCopy(targetLanguage);
  let markdown = String(value || "")
    .replace(/^```(?:markdown)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/^####\s+/gm, "### ")
    .trim();

  const replacements: Array<[RegExp, string]> = [
    [
      /^###\s*Corresponding Author\s*$/gim,
      `### ${copy.headings.correspondingAuthor}`,
    ],
    [
      /^###\s*Academic Information\s*$/gim,
      `### ${copy.headings.academicInformation}`,
    ],
    [
      /^###\s*Academic Profile\s*$/gim,
      `### ${copy.headings.academicInformation}`,
    ],
    [
      /^###\s*Relation to This Paper\s*$/gim,
      `### ${copy.headings.relationToPaper}`,
    ],
    [/^###\s*Sources\s*$/gim, `### ${copy.headings.sources}`],
    [/^- Name\s*[:：]/gim, `- ${copy.fields.name}:`],
    [/^- Affiliation\s*[:：]/gim, `- ${copy.fields.affiliation}:`],
    [/^- Email\s*[:：]/gim, `- ${copy.fields.email}:`],
    [
      /^- Evidence and confidence\s*[:：]/gim,
      `- ${copy.fields.evidenceConfidence}:`,
    ],
    [/^- Research focus\s*[:：]/gim, `- ${copy.fields.paperRelatedTopics}:`],
    [
      /^- Paper-related topics\s*[:：]/gim,
      `- ${copy.fields.paperRelatedTopics}:`,
    ],
    [
      /^- Public scholarly indicators\s*[:：]/gim,
      `- ${copy.fields.publicScholarlyIndicators}:`,
    ],
    [/^- Evidence\s*[:：]/gim, `- ${copy.fields.evidence}:`],
    [/^- Databases\s*[:：]/gim, `- ${copy.fields.dataSources}:`],
    [/^- Data sources\s*[:：]/gim, `- ${copy.fields.dataSources}:`],
  ];
  if (isChineseTarget(targetLanguage)) {
    replacements.push(
      [/^###\s*学术档案\s*$/gm, `### ${copy.headings.academicInformation}`],
      [/JSON\s*未提供公开学术指标信息[。.]?/gi, copy.missingMetrics],
      [/JSON\s*未提供/gi, "未检索到可靠公开信息："],
      [/其研究聚焦于/g, "从本文主题可见，本文相关方向包括"],
    );
  }
  for (const [pattern, replacement] of replacements) {
    markdown = markdown.replace(pattern, replacement);
  }
  return markdown;
}

export async function generateAuthorProfileMarkdown(
  item: Zotero.Item,
  input: AuthorProfileInput,
  progress?: AuthorProfileProgressCallback,
  signal?: AbortSignal,
): Promise<AuthorProfileResult> {
  const targetLanguage = getAuthorProfileLanguage();
  const copy = getAuthorProfileCopy(targetLanguage);
  progress?.({
    stage: "llm",
    message: copy.stageLlm,
    fraction: 0.78,
  });
  const profile = resolveAuthorProfileModel(item);
  const markdown = sanitizeMarkdown(
    await callLLM({
      prompt: buildPrompt(input, targetLanguage),
      model: profile.model,
      apiBase: profile.apiBase,
      apiKey: profile.apiKey,
      temperature: 0.3,
      maxTokens: 1800,
      signal,
    }),
    targetLanguage,
  );
  if (!markdown) {
    throw new Error(copy.emptyResponseError);
  }
  return {
    markdown,
    noteTitle: copy.noteTitle,
    language: targetLanguage,
    generatedAt: new Date().toISOString(),
    model: profile.model,
    sources: input.sourceResults,
  };
}
