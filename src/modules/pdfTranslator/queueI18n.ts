/* ---------------------------------------------------------------------------
 * pdfTranslator/queueI18n.ts  –  Strings for the translation queue
 *
 * Used by the library context menu and by the queue section of the Translate
 * tab. Covers every language the panel UI supports.
 * -------------------------------------------------------------------------*/

import type { PanelLang } from "../contextPanel/languages";
import type { QueueItemStatus, QueuePauseKind } from "./translationQueue";

export type QueueCopy = {
  menuAdd: (count: number) => string;
  menuStop: (percent: number) => string;
  confirmStop: string;
  /** e.g. "Translating 2/5 · 42%". */
  progress: (index: number, total: number, percent: number) => string;
  added: (count: number) => string;
  skipped: (count: number) => string;
  duplicates: (count: number) => string;
  withoutPdf: (count: number) => string;
  separator: string;
  pausedHint: string;
  batchDone: (done: number, failed: number, skipped: number) => string;
  pause: Record<QueuePauseKind, string>;
  title: string;
  empty: string;
  summary: (done: number, total: number) => string;
  status: Record<QueueItemStatus, string>;
  btnPause: string;
  btnResume: string;
  btnClear: string;
  btnRetry: string;
  btnRemove: string;
  btnOpen: string;
  btnCancel: string;
  btnFirst: string;
  optAttach: string;
  optSaveToDir: string;
  optSkipExisting: string;
  storageNote: string;
  needFolder: string;
};

const COPY: Record<PanelLang, QueueCopy> = {
  "en-US": {
    menuAdd: (n) =>
      n > 1
        ? `AIdea: Add ${n} PDFs to the translation queue`
        : "AIdea: Translate full PDF",
    menuStop: (p) => `AIdea: Stop PDF translation (${p}%)`,
    confirmStop:
      "Stop the translation queue? The current document goes back in line and nothing is lost.",
    progress: (i, t, p) => `Translating ${i}/${t} · ${p}%`,
    added: (n) => `${n} added to the queue`,
    skipped: (n) => `${n} skipped (already translated)`,
    duplicates: (n) => `${n} already in the queue`,
    withoutPdf: (n) => `${n} without a PDF`,
    separator: "; ",
    pausedHint:
      "The queue is paused. Open the AIdea Translate tab and choose Continue.",
    batchDone: (d, f, s) =>
      `Translation queue finished: ${d} done, ${f} failed, ${s} skipped.`,
    pause: {
      user: "Paused.",
      restored:
        "Restored from the last session. Choose Continue to start translating.",
      credentials:
        "Paused: the model sign-in or API key was rejected. Fix it, then choose Continue.",
      environment:
        "Paused: the translation environment is not ready. Install or repair it, then choose Continue.",
      network:
        "Paused: the model service could not be reached. Check the network or proxy, then choose Continue.",
      rate_limit:
        "Paused: the model service is rate-limiting requests. Wait a while, then choose Continue.",
    },
    title: "Translation queue",
    empty:
      "No documents queued. Select items in the library, right-click, and choose the AIdea translate entry.",
    summary: (d, t) => `${d}/${t} finished`,
    status: {
      queued: "Queued",
      running: "Translating",
      done: "Done",
      failed: "Failed",
      cancelled: "Cancelled",
      skipped: "Skipped (already translated)",
      interrupted: "Interrupted",
    },
    btnPause: "Pause",
    btnResume: "Continue",
    btnClear: "Clear finished",
    btnRetry: "Retry",
    btnRemove: "Remove",
    btnOpen: "Open",
    btnCancel: "Cancel",
    btnFirst: "Move to front",
    optAttach: "Add the translation to the Zotero item",
    optSaveToDir: "Also save to the output folder",
    optSkipExisting: "Batch: skip documents that are already translated",
    storageNote:
      "Translations added to items count toward Zotero storage; two output formats take twice the space.",
    needFolder:
      "Choose an output folder, or turn on adding to the Zotero item.",
  },
  "zh-CN": {
    menuAdd: (n) =>
      n > 1 ? `AIdea：将 ${n} 个 PDF 加入翻译队列` : "AIdea：翻译全文 PDF",
    menuStop: (p) => `AIdea：停止 PDF 翻译（${p}%）`,
    confirmStop: "要停止翻译队列吗？当前文档会回到队列中，不会丢失。",
    progress: (i, t, p) => `正在翻译 ${i}/${t} · ${p}%`,
    added: (n) => `已加入队列 ${n} 篇`,
    skipped: (n) => `跳过 ${n} 篇（已有译文）`,
    duplicates: (n) => `${n} 篇已在队列中`,
    withoutPdf: (n) => `${n} 个条目没有 PDF`,
    separator: "；",
    pausedHint: "队列处于暂停状态，请打开 AIdea 翻译标签页并点击“继续”。",
    batchDone: (d, f, s) =>
      `翻译队列已完成：成功 ${d} 篇，失败 ${f} 篇，跳过 ${s} 篇。`,
    pause: {
      user: "已暂停。",
      restored: "已恢复上次的队列，点击“继续”开始翻译。",
      credentials: "已暂停：模型登录或 API Key 被拒绝，修复后点击“继续”。",
      environment: "已暂停：翻译环境未就绪，安装或修复后点击“继续”。",
      network: "已暂停：无法连接模型服务，请检查网络或代理后点击“继续”。",
      rate_limit: "已暂停：模型服务正在限流，请稍等一会儿再点击“继续”。",
    },
    title: "翻译队列",
    empty: "队列为空。在文献库中选中条目，右键选择 AIdea 翻译即可加入。",
    summary: (d, t) => `已完成 ${d}/${t}`,
    status: {
      queued: "排队中",
      running: "翻译中",
      done: "完成",
      failed: "失败",
      cancelled: "已取消",
      skipped: "已跳过（已有译文）",
      interrupted: "已中断",
    },
    btnPause: "暂停",
    btnResume: "继续",
    btnClear: "清除已结束",
    btnRetry: "重试",
    btnRemove: "移除",
    btnOpen: "打开",
    btnCancel: "取消",
    btnFirst: "移到最前",
    optAttach: "将译文添加到对应的 Zotero 条目",
    optSaveToDir: "同时保存到输出文件夹",
    optSkipExisting: "批量添加时跳过已有译文的文档",
    storageNote:
      "添加到条目的译文会占用 Zotero 存储空间；同时生成两种格式时占用翻倍。",
    needFolder: "请选择输出文件夹，或勾选“添加到 Zotero 条目”。",
  },
  "zh-TW": {
    menuAdd: (n) =>
      n > 1 ? `AIdea：將 ${n} 個 PDF 加入翻譯佇列` : "AIdea：翻譯全文 PDF",
    menuStop: (p) => `AIdea：停止 PDF 翻譯（${p}%）`,
    confirmStop: "要停止翻譯佇列嗎？目前的文件會回到佇列中，不會遺失。",
    progress: (i, t, p) => `正在翻譯 ${i}/${t} · ${p}%`,
    added: (n) => `已加入佇列 ${n} 篇`,
    skipped: (n) => `略過 ${n} 篇（已有譯文）`,
    duplicates: (n) => `${n} 篇已在佇列中`,
    withoutPdf: (n) => `${n} 個條目沒有 PDF`,
    separator: "；",
    pausedHint: "佇列已暫停，請開啟 AIdea 翻譯分頁並點選「繼續」。",
    batchDone: (d, f, s) =>
      `翻譯佇列已完成：成功 ${d} 篇，失敗 ${f} 篇，略過 ${s} 篇。`,
    pause: {
      user: "已暫停。",
      restored: "已還原上次的佇列，點選「繼續」開始翻譯。",
      credentials: "已暫停：模型登入或 API Key 被拒絕，修正後點選「繼續」。",
      environment: "已暫停：翻譯環境尚未就緒，安裝或修復後點選「繼續」。",
      network: "已暫停：無法連線到模型服務，請檢查網路或代理後點選「繼續」。",
      rate_limit: "已暫停：模型服務正在限流，請稍候再點選「繼續」。",
    },
    title: "翻譯佇列",
    empty: "佇列是空的。在文獻庫選取條目，按右鍵選擇 AIdea 翻譯即可加入。",
    summary: (d, t) => `已完成 ${d}/${t}`,
    status: {
      queued: "排隊中",
      running: "翻譯中",
      done: "完成",
      failed: "失敗",
      cancelled: "已取消",
      skipped: "已略過（已有譯文）",
      interrupted: "已中斷",
    },
    btnPause: "暫停",
    btnResume: "繼續",
    btnClear: "清除已結束",
    btnRetry: "重試",
    btnRemove: "移除",
    btnOpen: "開啟",
    btnCancel: "取消",
    btnFirst: "移到最前",
    optAttach: "將譯文加入對應的 Zotero 條目",
    optSaveToDir: "同時儲存到輸出資料夾",
    optSkipExisting: "批次加入時略過已有譯文的文件",
    storageNote:
      "加入條目的譯文會佔用 Zotero 儲存空間；同時產生兩種格式時佔用加倍。",
    needFolder: "請選擇輸出資料夾，或勾選「加入 Zotero 條目」。",
  },
  "ja-JP": {
    menuAdd: (n) =>
      n > 1
        ? `AIdea：${n} 件の PDF を翻訳キューに追加`
        : "AIdea：PDF 全文を翻訳",
    menuStop: (p) => `AIdea：PDF 翻訳を停止（${p}%）`,
    confirmStop:
      "翻訳キューを停止しますか？現在の文書はキューに戻り、失われません。",
    progress: (i, t, p) => `翻訳中 ${i}/${t} · ${p}%`,
    added: (n) => `${n} 件をキューに追加`,
    skipped: (n) => `${n} 件をスキップ（翻訳済み）`,
    duplicates: (n) => `${n} 件はすでにキューにあります`,
    withoutPdf: (n) => `${n} 件は PDF がありません`,
    separator: "、",
    pausedHint:
      "キューは一時停止中です。AIdea の翻訳タブで「続行」を選んでください。",
    batchDone: (d, f, s) =>
      `翻訳キューが完了しました：成功 ${d}、失敗 ${f}、スキップ ${s}。`,
    pause: {
      user: "一時停止中。",
      restored: "前回のキューを復元しました。「続行」で翻訳を開始します。",
      credentials:
        "一時停止：モデルのサインインまたは API キーが拒否されました。修正後に「続行」を選んでください。",
      environment:
        "一時停止：翻訳環境の準備ができていません。インストールまたは修復後に「続行」を選んでください。",
      network:
        "一時停止：モデルサービスに接続できません。ネットワークやプロキシを確認し、「続行」を選んでください。",
      rate_limit:
        "一時停止：モデルサービスがレート制限中です。しばらく待ってから「続行」を選んでください。",
    },
    title: "翻訳キュー",
    empty:
      "キューは空です。ライブラリでアイテムを選択し、右クリックから AIdea の翻訳を選んでください。",
    summary: (d, t) => `${d}/${t} 完了`,
    status: {
      queued: "待機中",
      running: "翻訳中",
      done: "完了",
      failed: "失敗",
      cancelled: "キャンセル済み",
      skipped: "スキップ（翻訳済み）",
      interrupted: "中断",
    },
    btnPause: "一時停止",
    btnResume: "続行",
    btnClear: "終了分を消去",
    btnRetry: "再試行",
    btnRemove: "削除",
    btnOpen: "開く",
    btnCancel: "キャンセル",
    btnFirst: "先頭へ",
    optAttach: "訳文を Zotero アイテムに追加",
    optSaveToDir: "出力フォルダーにも保存",
    optSkipExisting: "一括追加時に翻訳済みの文書をスキップ",
    storageNote:
      "アイテムに追加した訳文は Zotero のストレージを使用します。2 形式を出力すると使用量は 2 倍になります。",
    needFolder:
      "出力フォルダーを選ぶか、「Zotero アイテムに追加」を有効にしてください。",
  },
  "ko-KR": {
    menuAdd: (n) =>
      n > 1 ? `AIdea: PDF ${n}개를 번역 대기열에 추가` : "AIdea: PDF 전체 번역",
    menuStop: (p) => `AIdea: PDF 번역 중지 (${p}%)`,
    confirmStop:
      "번역 대기열을 중지할까요? 현재 문서는 대기열로 돌아가며 사라지지 않습니다.",
    progress: (i, t, p) => `번역 중 ${i}/${t} · ${p}%`,
    added: (n) => `${n}개를 대기열에 추가`,
    skipped: (n) => `${n}개 건너뜀(이미 번역됨)`,
    duplicates: (n) => `${n}개는 이미 대기열에 있음`,
    withoutPdf: (n) => `${n}개는 PDF 없음`,
    separator: "; ",
    pausedHint:
      "대기열이 일시 중지되었습니다. AIdea 번역 탭에서 '계속'을 선택하세요.",
    batchDone: (d, f, s) =>
      `번역 대기열 완료: 성공 ${d}, 실패 ${f}, 건너뜀 ${s}.`,
    pause: {
      user: "일시 중지됨.",
      restored: "이전 대기열을 복원했습니다. '계속'을 눌러 번역을 시작하세요.",
      credentials:
        "일시 중지: 모델 로그인 또는 API 키가 거부되었습니다. 수정한 뒤 '계속'을 선택하세요.",
      environment:
        "일시 중지: 번역 환경이 준비되지 않았습니다. 설치 또는 복구한 뒤 '계속'을 선택하세요.",
      network:
        "일시 중지: 모델 서비스에 연결할 수 없습니다. 네트워크나 프록시를 확인한 뒤 '계속'을 선택하세요.",
      rate_limit:
        "일시 중지: 모델 서비스가 요청을 제한하고 있습니다. 잠시 후 '계속'을 선택하세요.",
    },
    title: "번역 대기열",
    empty:
      "대기열이 비어 있습니다. 라이브러리에서 항목을 선택하고 마우스 오른쪽 버튼으로 AIdea 번역을 선택하세요.",
    summary: (d, t) => `${d}/${t} 완료`,
    status: {
      queued: "대기 중",
      running: "번역 중",
      done: "완료",
      failed: "실패",
      cancelled: "취소됨",
      skipped: "건너뜀(이미 번역됨)",
      interrupted: "중단됨",
    },
    btnPause: "일시 중지",
    btnResume: "계속",
    btnClear: "끝난 항목 지우기",
    btnRetry: "다시 시도",
    btnRemove: "제거",
    btnOpen: "열기",
    btnCancel: "취소",
    btnFirst: "맨 앞으로",
    optAttach: "번역본을 Zotero 항목에 추가",
    optSaveToDir: "출력 폴더에도 저장",
    optSkipExisting: "일괄 추가 시 이미 번역된 문서 건너뛰기",
    storageNote:
      "항목에 추가한 번역본은 Zotero 저장 공간을 사용하며, 두 형식을 모두 출력하면 두 배가 됩니다.",
    needFolder: "출력 폴더를 선택하거나 'Zotero 항목에 추가'를 켜세요.",
  },
  "fr-FR": {
    menuAdd: (n) =>
      n > 1
        ? `AIdea : ajouter ${n} PDF à la file de traduction`
        : "AIdea : traduire le PDF complet",
    menuStop: (p) => `AIdea : arrêter la traduction PDF (${p} %)`,
    confirmStop:
      "Arrêter la file de traduction ? Le document en cours retourne dans la file, rien n'est perdu.",
    progress: (i, t, p) => `Traduction ${i}/${t} · ${p} %`,
    added: (n) => `${n} ajouté(s) à la file`,
    skipped: (n) => `${n} ignoré(s) (déjà traduit)`,
    duplicates: (n) => `${n} déjà dans la file`,
    withoutPdf: (n) => `${n} sans PDF`,
    separator: " ; ",
    pausedHint:
      "La file est en pause. Ouvrez l'onglet Traduction d'AIdea et choisissez Continuer.",
    batchDone: (d, f, s) =>
      `File de traduction terminée : ${d} réussi(s), ${f} en échec, ${s} ignoré(s).`,
    pause: {
      user: "En pause.",
      restored:
        "File restaurée depuis la dernière session. Choisissez Continuer pour lancer la traduction.",
      credentials:
        "En pause : la connexion au modèle ou la clé API a été refusée. Corrigez-la, puis choisissez Continuer.",
      environment:
        "En pause : l'environnement de traduction n'est pas prêt. Installez-le ou réparez-le, puis choisissez Continuer.",
      network:
        "En pause : le service du modèle est injoignable. Vérifiez le réseau ou le proxy, puis choisissez Continuer.",
      rate_limit:
        "En pause : le service du modèle limite les requêtes. Patientez, puis choisissez Continuer.",
    },
    title: "File de traduction",
    empty:
      "Aucun document en file. Sélectionnez des éléments dans la bibliothèque, faites un clic droit et choisissez l'entrée de traduction AIdea.",
    summary: (d, t) => `${d}/${t} terminé(s)`,
    status: {
      queued: "En attente",
      running: "Traduction",
      done: "Terminé",
      failed: "Échec",
      cancelled: "Annulé",
      skipped: "Ignoré (déjà traduit)",
      interrupted: "Interrompu",
    },
    btnPause: "Pause",
    btnResume: "Continuer",
    btnClear: "Effacer les terminés",
    btnRetry: "Réessayer",
    btnRemove: "Retirer",
    btnOpen: "Ouvrir",
    btnCancel: "Annuler",
    btnFirst: "Placer en tête",
    optAttach: "Ajouter la traduction à l'élément Zotero",
    optSaveToDir: "Enregistrer aussi dans le dossier de sortie",
    optSkipExisting: "Par lot : ignorer les documents déjà traduits",
    storageNote:
      "Les traductions ajoutées aux éléments occupent le stockage Zotero ; deux formats de sortie doublent l'espace utilisé.",
    needFolder:
      "Choisissez un dossier de sortie ou activez l'ajout à l'élément Zotero.",
  },
  "de-DE": {
    menuAdd: (n) =>
      n > 1
        ? `AIdea: ${n} PDFs zur Übersetzungswarteschlange hinzufügen`
        : "AIdea: Gesamtes PDF übersetzen",
    menuStop: (p) => `AIdea: PDF-Übersetzung stoppen (${p} %)`,
    confirmStop:
      "Übersetzungswarteschlange stoppen? Das aktuelle Dokument wird wieder eingereiht, nichts geht verloren.",
    progress: (i, t, p) => `Übersetzung ${i}/${t} · ${p} %`,
    added: (n) => `${n} zur Warteschlange hinzugefügt`,
    skipped: (n) => `${n} übersprungen (bereits übersetzt)`,
    duplicates: (n) => `${n} bereits in der Warteschlange`,
    withoutPdf: (n) => `${n} ohne PDF`,
    separator: "; ",
    pausedHint:
      "Die Warteschlange ist pausiert. Öffnen Sie den AIdea-Tab „Übersetzen“ und wählen Sie „Fortsetzen“.",
    batchDone: (d, f, s) =>
      `Übersetzungswarteschlange abgeschlossen: ${d} fertig, ${f} fehlgeschlagen, ${s} übersprungen.`,
    pause: {
      user: "Pausiert.",
      restored:
        "Aus der letzten Sitzung wiederhergestellt. Wählen Sie „Fortsetzen“, um zu übersetzen.",
      credentials:
        "Pausiert: Die Modellanmeldung oder der API-Schlüssel wurde abgelehnt. Beheben Sie das und wählen Sie „Fortsetzen“.",
      environment:
        "Pausiert: Die Übersetzungsumgebung ist nicht bereit. Installieren oder reparieren Sie sie und wählen Sie „Fortsetzen“.",
      network:
        "Pausiert: Der Modelldienst ist nicht erreichbar. Prüfen Sie Netzwerk oder Proxy und wählen Sie „Fortsetzen“.",
      rate_limit:
        "Pausiert: Der Modelldienst begrenzt Anfragen. Warten Sie kurz und wählen Sie „Fortsetzen“.",
    },
    title: "Übersetzungswarteschlange",
    empty:
      "Keine Dokumente in der Warteschlange. Wählen Sie Einträge in der Bibliothek, klicken Sie mit der rechten Maustaste und wählen Sie den AIdea-Übersetzungseintrag.",
    summary: (d, t) => `${d}/${t} abgeschlossen`,
    status: {
      queued: "Wartet",
      running: "Wird übersetzt",
      done: "Fertig",
      failed: "Fehlgeschlagen",
      cancelled: "Abgebrochen",
      skipped: "Übersprungen (bereits übersetzt)",
      interrupted: "Unterbrochen",
    },
    btnPause: "Pause",
    btnResume: "Fortsetzen",
    btnClear: "Abgeschlossene entfernen",
    btnRetry: "Erneut versuchen",
    btnRemove: "Entfernen",
    btnOpen: "Öffnen",
    btnCancel: "Abbrechen",
    btnFirst: "Nach vorn",
    optAttach: "Übersetzung zum Zotero-Eintrag hinzufügen",
    optSaveToDir: "Zusätzlich im Ausgabeordner speichern",
    optSkipExisting: "Stapel: bereits übersetzte Dokumente überspringen",
    storageNote:
      "Zu Einträgen hinzugefügte Übersetzungen belegen Zotero-Speicher; zwei Ausgabeformate verdoppeln den Platzbedarf.",
    needFolder:
      "Wählen Sie einen Ausgabeordner oder aktivieren Sie das Hinzufügen zum Zotero-Eintrag.",
  },
  "es-ES": {
    menuAdd: (n) =>
      n > 1
        ? `AIdea: añadir ${n} PDF a la cola de traducción`
        : "AIdea: traducir el PDF completo",
    menuStop: (p) => `AIdea: detener la traducción de PDF (${p} %)`,
    confirmStop:
      "¿Detener la cola de traducción? El documento actual vuelve a la cola y no se pierde nada.",
    progress: (i, t, p) => `Traduciendo ${i}/${t} · ${p} %`,
    added: (n) => `${n} añadido(s) a la cola`,
    skipped: (n) => `${n} omitido(s) (ya traducido)`,
    duplicates: (n) => `${n} ya en la cola`,
    withoutPdf: (n) => `${n} sin PDF`,
    separator: "; ",
    pausedHint:
      "La cola está en pausa. Abre la pestaña Traducir de AIdea y elige Continuar.",
    batchDone: (d, f, s) =>
      `Cola de traducción terminada: ${d} completado(s), ${f} con error, ${s} omitido(s).`,
    pause: {
      user: "En pausa.",
      restored:
        "Cola restaurada de la última sesión. Elige Continuar para empezar a traducir.",
      credentials:
        "En pausa: se rechazó el inicio de sesión del modelo o la clave API. Corrígelo y elige Continuar.",
      environment:
        "En pausa: el entorno de traducción no está listo. Instálalo o repáralo y elige Continuar.",
      network:
        "En pausa: no se pudo conectar con el servicio del modelo. Revisa la red o el proxy y elige Continuar.",
      rate_limit:
        "En pausa: el servicio del modelo está limitando las solicitudes. Espera un momento y elige Continuar.",
    },
    title: "Cola de traducción",
    empty:
      "No hay documentos en cola. Selecciona elementos en la biblioteca, haz clic derecho y elige la opción de traducción de AIdea.",
    summary: (d, t) => `${d}/${t} terminado(s)`,
    status: {
      queued: "En cola",
      running: "Traduciendo",
      done: "Completado",
      failed: "Error",
      cancelled: "Cancelado",
      skipped: "Omitido (ya traducido)",
      interrupted: "Interrumpido",
    },
    btnPause: "Pausar",
    btnResume: "Continuar",
    btnClear: "Borrar terminados",
    btnRetry: "Reintentar",
    btnRemove: "Quitar",
    btnOpen: "Abrir",
    btnCancel: "Cancelar",
    btnFirst: "Mover al principio",
    optAttach: "Añadir la traducción al elemento de Zotero",
    optSaveToDir: "Guardar también en la carpeta de salida",
    optSkipExisting: "Por lotes: omitir documentos ya traducidos",
    storageNote:
      "Las traducciones añadidas a los elementos ocupan almacenamiento de Zotero; dos formatos de salida duplican el espacio.",
    needFolder:
      "Elige una carpeta de salida o activa añadir al elemento de Zotero.",
  },
  "ru-RU": {
    menuAdd: (n) =>
      n > 1
        ? `AIdea: добавить PDF (${n}) в очередь перевода`
        : "AIdea: перевести PDF целиком",
    menuStop: (p) => `AIdea: остановить перевод PDF (${p}%)`,
    confirmStop:
      "Остановить очередь перевода? Текущий документ вернётся в очередь, ничего не потеряется.",
    progress: (i, t, p) => `Перевод ${i}/${t} · ${p}%`,
    added: (n) => `Добавлено в очередь: ${n}`,
    skipped: (n) => `Пропущено (уже переведено): ${n}`,
    duplicates: (n) => `Уже в очереди: ${n}`,
    withoutPdf: (n) => `Без PDF: ${n}`,
    separator: "; ",
    pausedHint:
      "Очередь приостановлена. Откройте вкладку перевода AIdea и нажмите «Продолжить».",
    batchDone: (d, f, s) =>
      `Очередь перевода завершена: готово ${d}, ошибок ${f}, пропущено ${s}.`,
    pause: {
      user: "Приостановлено.",
      restored:
        "Очередь восстановлена с прошлого сеанса. Нажмите «Продолжить», чтобы начать перевод.",
      credentials:
        "Приостановлено: вход в модель или API-ключ отклонён. Исправьте и нажмите «Продолжить».",
      environment:
        "Приостановлено: среда перевода не готова. Установите или восстановите её и нажмите «Продолжить».",
      network:
        "Приостановлено: сервис модели недоступен. Проверьте сеть или прокси и нажмите «Продолжить».",
      rate_limit:
        "Приостановлено: сервис модели ограничивает запросы. Подождите и нажмите «Продолжить».",
    },
    title: "Очередь перевода",
    empty:
      "В очереди нет документов. Выберите элементы в библиотеке, щёлкните правой кнопкой и выберите перевод AIdea.",
    summary: (d, t) => `Завершено ${d}/${t}`,
    status: {
      queued: "В очереди",
      running: "Перевод",
      done: "Готово",
      failed: "Ошибка",
      cancelled: "Отменено",
      skipped: "Пропущено (уже переведено)",
      interrupted: "Прервано",
    },
    btnPause: "Пауза",
    btnResume: "Продолжить",
    btnClear: "Очистить завершённые",
    btnRetry: "Повторить",
    btnRemove: "Удалить",
    btnOpen: "Открыть",
    btnCancel: "Отмена",
    btnFirst: "В начало",
    optAttach: "Добавлять перевод к элементу Zotero",
    optSaveToDir: "Также сохранять в папку вывода",
    optSkipExisting: "Пакетно: пропускать уже переведённые документы",
    storageNote:
      "Переводы, добавленные к элементам, занимают хранилище Zotero; два формата вывода занимают вдвое больше места.",
    needFolder:
      "Выберите папку вывода или включите добавление к элементу Zotero.",
  },
  "pt-BR": {
    menuAdd: (n) =>
      n > 1
        ? `AIdea: adicionar ${n} PDFs à fila de tradução`
        : "AIdea: traduzir o PDF completo",
    menuStop: (p) => `AIdea: parar a tradução de PDF (${p}%)`,
    confirmStop:
      "Parar a fila de tradução? O documento atual volta para a fila e nada é perdido.",
    progress: (i, t, p) => `Traduzindo ${i}/${t} · ${p}%`,
    added: (n) => `${n} adicionado(s) à fila`,
    skipped: (n) => `${n} ignorado(s) (já traduzido)`,
    duplicates: (n) => `${n} já na fila`,
    withoutPdf: (n) => `${n} sem PDF`,
    separator: "; ",
    pausedHint:
      "A fila está pausada. Abra a aba Traduzir do AIdea e escolha Continuar.",
    batchDone: (d, f, s) =>
      `Fila de tradução concluída: ${d} concluído(s), ${f} com falha, ${s} ignorado(s).`,
    pause: {
      user: "Pausada.",
      restored:
        "Fila restaurada da última sessão. Escolha Continuar para começar a traduzir.",
      credentials:
        "Pausada: o login do modelo ou a chave de API foi rejeitado. Corrija e escolha Continuar.",
      environment:
        "Pausada: o ambiente de tradução não está pronto. Instale ou repare e escolha Continuar.",
      network:
        "Pausada: não foi possível acessar o serviço do modelo. Verifique a rede ou o proxy e escolha Continuar.",
      rate_limit:
        "Pausada: o serviço do modelo está limitando as solicitações. Aguarde um pouco e escolha Continuar.",
    },
    title: "Fila de tradução",
    empty:
      "Nenhum documento na fila. Selecione itens na biblioteca, clique com o botão direito e escolha a opção de tradução do AIdea.",
    summary: (d, t) => `${d}/${t} concluído(s)`,
    status: {
      queued: "Na fila",
      running: "Traduzindo",
      done: "Concluído",
      failed: "Falhou",
      cancelled: "Cancelado",
      skipped: "Ignorado (já traduzido)",
      interrupted: "Interrompido",
    },
    btnPause: "Pausar",
    btnResume: "Continuar",
    btnClear: "Limpar concluídos",
    btnRetry: "Tentar novamente",
    btnRemove: "Remover",
    btnOpen: "Abrir",
    btnCancel: "Cancelar",
    btnFirst: "Mover para o início",
    optAttach: "Adicionar a tradução ao item do Zotero",
    optSaveToDir: "Salvar também na pasta de saída",
    optSkipExisting: "Em lote: ignorar documentos já traduzidos",
    storageNote:
      "As traduções adicionadas aos itens ocupam o armazenamento do Zotero; dois formatos de saída ocupam o dobro do espaço.",
    needFolder:
      "Escolha uma pasta de saída ou ative a adição ao item do Zotero.",
  },
  "ar-SA": {
    menuAdd: (n) =>
      n > 1
        ? `AIdea: إضافة ${n} ملفات PDF إلى قائمة انتظار الترجمة`
        : "AIdea: ترجمة ملف PDF كاملًا",
    menuStop: (p) => `AIdea: إيقاف ترجمة PDF (${p}%)`,
    confirmStop:
      "هل تريد إيقاف قائمة انتظار الترجمة؟ سيعود المستند الحالي إلى القائمة ولن يُفقد شيء.",
    progress: (i, t, p) => `جارٍ ترجمة ${i}/${t} · ${p}%`,
    added: (n) => `أُضيف إلى القائمة: ${n}`,
    skipped: (n) => `تم تخطي: ${n} (مترجم مسبقًا)`,
    duplicates: (n) => `موجود مسبقًا في القائمة: ${n}`,
    withoutPdf: (n) => `بدون PDF: ${n}`,
    separator: "؛ ",
    pausedHint:
      "قائمة الانتظار متوقفة مؤقتًا. افتح تبويب الترجمة في AIdea واختر «متابعة».",
    batchDone: (d, f, s) =>
      `اكتملت قائمة انتظار الترجمة: نجح ${d}، فشل ${f}، تم تخطي ${s}.`,
    pause: {
      user: "متوقفة مؤقتًا.",
      restored:
        "تمت استعادة القائمة من الجلسة السابقة. اختر «متابعة» لبدء الترجمة.",
      credentials:
        "متوقفة: رُفض تسجيل الدخول إلى النموذج أو مفتاح API. أصلح ذلك ثم اختر «متابعة».",
      environment:
        "متوقفة: بيئة الترجمة غير جاهزة. ثبّتها أو أصلحها ثم اختر «متابعة».",
      network:
        "متوقفة: تعذر الوصول إلى خدمة النموذج. تحقق من الشبكة أو الوكيل ثم اختر «متابعة».",
      rate_limit:
        "متوقفة: خدمة النموذج تحدّ من الطلبات. انتظر قليلًا ثم اختر «متابعة».",
    },
    title: "قائمة انتظار الترجمة",
    empty:
      "لا توجد مستندات في القائمة. حدد عناصر في المكتبة، انقر بزر الفأرة الأيمن واختر ترجمة AIdea.",
    summary: (d, t) => `اكتمل ${d}/${t}`,
    status: {
      queued: "في الانتظار",
      running: "جارٍ الترجمة",
      done: "تم",
      failed: "فشل",
      cancelled: "أُلغي",
      skipped: "تم التخطي (مترجم مسبقًا)",
      interrupted: "متوقف",
    },
    btnPause: "إيقاف مؤقت",
    btnResume: "متابعة",
    btnClear: "مسح المنتهية",
    btnRetry: "إعادة المحاولة",
    btnRemove: "إزالة",
    btnOpen: "فتح",
    btnCancel: "إلغاء",
    btnFirst: "نقل إلى البداية",
    optAttach: "إضافة الترجمة إلى عنصر Zotero",
    optSaveToDir: "الحفظ أيضًا في مجلد الإخراج",
    optSkipExisting: "عند الإضافة المجمّعة: تخطي المستندات المترجمة مسبقًا",
    storageNote:
      "الترجمات المضافة إلى العناصر تستهلك مساحة تخزين Zotero، وإخراج تنسيقين يضاعف المساحة.",
    needFolder: "اختر مجلد إخراج أو فعّل الإضافة إلى عنصر Zotero.",
  },
  "hi-IN": {
    menuAdd: (n) =>
      n > 1
        ? `AIdea: ${n} PDF अनुवाद कतार में जोड़ें`
        : "AIdea: पूरा PDF अनुवाद करें",
    menuStop: (p) => `AIdea: PDF अनुवाद रोकें (${p}%)`,
    confirmStop:
      "अनुवाद कतार रोकें? वर्तमान दस्तावेज़ कतार में वापस चला जाएगा, कुछ भी नहीं खोएगा।",
    progress: (i, t, p) => `अनुवाद हो रहा है ${i}/${t} · ${p}%`,
    added: (n) => `कतार में जोड़े गए: ${n}`,
    skipped: (n) => `छोड़े गए (पहले से अनूदित): ${n}`,
    duplicates: (n) => `पहले से कतार में: ${n}`,
    withoutPdf: (n) => `बिना PDF: ${n}`,
    separator: "; ",
    pausedHint:
      "कतार रुकी हुई है। AIdea का अनुवाद टैब खोलें और “जारी रखें” चुनें।",
    batchDone: (d, f, s) =>
      `अनुवाद कतार पूरी हुई: ${d} पूर्ण, ${f} विफल, ${s} छोड़े गए।`,
    pause: {
      user: "रुकी हुई।",
      restored:
        "पिछले सत्र की कतार बहाल की गई। अनुवाद शुरू करने के लिए “जारी रखें” चुनें।",
      credentials:
        "रुकी हुई: मॉडल साइन-इन या API कुंजी अस्वीकार हुई। इसे ठीक करें, फिर “जारी रखें” चुनें।",
      environment:
        "रुकी हुई: अनुवाद परिवेश तैयार नहीं है। इसे इंस्टॉल या ठीक करें, फिर “जारी रखें” चुनें।",
      network:
        "रुकी हुई: मॉडल सेवा तक नहीं पहुँचा जा सका। नेटवर्क या प्रॉक्सी जाँचें, फिर “जारी रखें” चुनें।",
      rate_limit:
        "रुकी हुई: मॉडल सेवा अनुरोध सीमित कर रही है। थोड़ा रुकें, फिर “जारी रखें” चुनें।",
    },
    title: "अनुवाद कतार",
    empty:
      "कतार खाली है। लाइब्रेरी में आइटम चुनें, राइट-क्लिक करें और AIdea अनुवाद चुनें।",
    summary: (d, t) => `${d}/${t} पूर्ण`,
    status: {
      queued: "कतार में",
      running: "अनुवाद हो रहा है",
      done: "पूर्ण",
      failed: "विफल",
      cancelled: "रद्द",
      skipped: "छोड़ा गया (पहले से अनूदित)",
      interrupted: "बाधित",
    },
    btnPause: "रोकें",
    btnResume: "जारी रखें",
    btnClear: "समाप्त हटाएँ",
    btnRetry: "पुनः प्रयास",
    btnRemove: "हटाएँ",
    btnOpen: "खोलें",
    btnCancel: "रद्द करें",
    btnFirst: "सबसे आगे करें",
    optAttach: "अनुवाद को Zotero आइटम में जोड़ें",
    optSaveToDir: "आउटपुट फ़ोल्डर में भी सहेजें",
    optSkipExisting: "बैच: पहले से अनूदित दस्तावेज़ छोड़ें",
    storageNote:
      "आइटम में जोड़े गए अनुवाद Zotero संग्रहण का उपयोग करते हैं; दो आउटपुट प्रारूप दोगुनी जगह लेते हैं।",
    needFolder: "आउटपुट फ़ोल्डर चुनें, या Zotero आइटम में जोड़ना चालू करें।",
  },
};

export function getQueueCopy(lang: PanelLang): QueueCopy {
  return COPY[lang] || COPY["en-US"];
}

/** "3 added to the queue; 1 skipped (already translated)". */
export function describeAddResult(
  copy: QueueCopy,
  result: {
    added: number;
    skipped: number;
    duplicates: number;
    withoutPdf: number;
  },
): string {
  const parts = [copy.added(result.added)];
  if (result.skipped) parts.push(copy.skipped(result.skipped));
  if (result.duplicates) parts.push(copy.duplicates(result.duplicates));
  if (result.withoutPdf) parts.push(copy.withoutPdf(result.withoutPdf));
  return parts.join(copy.separator);
}
