import type { PanelLang } from "../contextPanel/languages";

// Horizontal, single-style paragraphs are shaped with a selectable text map.
// Other page structures retain the engine layout rather than losing content.
const warnings: Record<PanelLang, string> = {
  "en-US":
    "Persian PDF export supports ordinary text. Rotated text, complex formatting or inline equations may keep the engine’s original layout and copy order. Continue?",
  "zh-CN":
    "波斯语 PDF 已支持普通横排段落。旋转文字、复杂排版或含行内公式的段落可能保留引擎原有排版，复制顺序也可能不正确。继续生成吗？",
  "zh-TW":
    "波斯語 PDF 已支援一般橫排段落。旋轉文字、複雜排版或含行內公式的段落可能保留引擎原有排版，複製順序也可能不正確。繼續產生嗎？",
  "fa-IR":
    "در PDF فارسی، بندهای معمولی راست‌به‌چپ نمایش داده می‌شوند. متن چرخیده، قالب‌بندی پیچیده یا فرمول‌های درون‌خطی ممکن است چیدمان موتور اصلی را حفظ کنند و هنگام کپی به ترتیب نادرست ظاهر شوند. ادامه می‌دهید؟",
  "ar-SA":
    "يدعم تصدير PDF بالفارسية الفقرات العادية. قد يحتفظ النص المدوّر أو التنسيق المعقد أو المعادلات المضمّنة بتخطيط المحرك الأصلي وترتيبه عند النسخ. هل تريد المتابعة؟",
  "ja-JP":
    "ペルシャ語 PDF は通常の横書き段落に対応します。回転した文字や複雑な書式、行内数式では、元のエンジンの配置やコピー順が残ることがあります。続行しますか？",
  "ko-KR":
    "페르시아어 PDF는 일반 문단을 지원합니다. 회전된 텍스트, 복잡한 서식이나 인라인 수식은 기존 엔진의 배치와 복사 순서를 유지할 수 있습니다. 계속할까요?",
  "fr-FR":
    "L’export PDF en persan prend en charge les paragraphes courants. Le texte pivoté, les mises en forme complexes et les formules en ligne peuvent conserver l’ordre du moteur d’origine, y compris à la copie. Continuer ?",
  "de-DE":
    "Der persische PDF-Export unterstützt normale Absätze. Bei gedrehtem Text, komplexer Formatierung oder eingebetteten Formeln können Layout und Kopierreihenfolge des ursprünglichen PDF-Moduls erhalten bleiben. Fortfahren?",
  "es-ES":
    "La exportación de PDF en persa admite párrafos normales. El texto girado, los formatos complejos o las fórmulas en línea pueden conservar la disposición y el orden de copia del motor original. ¿Continuar?",
  "ru-RU":
    "В PDF на персидском поддерживаются обычные абзацы. В повёрнутом тексте, сложной вёрстке или строках с формулами может сохраниться исходный порядок движка, в том числе при копировании. Продолжить?",
  "pt-BR":
    "A exportação de PDF em persa suporta parágrafos comuns. Texto girado, formatação complexa ou fórmulas em linha podem manter a disposição e a ordem de cópia do mecanismo original. Continuar?",
  "hi-IN":
    "फ़ारसी PDF निर्यात सामान्य अनुच्छेदों का समर्थन करता है। घुमाए हुए पाठ, जटिल स्वरूपण या पंक्ति के भीतर सूत्रों में मूल इंजन का लेआउट और कॉपी क्रम रह सकता है। जारी रखें?",
};

export function confirmPdfLayout(
  targetLang: string,
  uiLang: PanelLang,
  confirm: (message: string) => boolean = (message) =>
    Zotero.getMainWindow().confirm(message),
): boolean {
  return !/^fa(?:[-_]|$)/i.test(targetLang.trim()) || confirm(warnings[uiLang]);
}
