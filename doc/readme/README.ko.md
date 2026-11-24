<p align="center">
  <img src="../../addon/content/icons/icon-96.png" alt="AIdea 로고" width="88" />
</p>

# AIdea

<p align="center">
  <a href="../../README.md">English</a>
  ·
  <a href="./README.zh-CN.md">简体中文</a>
  ·
  <a href="./README.zh-TW.md">繁體中文</a>
  ·
  <a href="./README.ja.md">日本語</a>
  ·
  <a href="./README.ko.md">한국어</a>
  ·
  <a href="./README.fr.md">Français</a>
</p>

<p align="center">
  <strong>🌐 Website:</strong> <a href="https://visterainer.github.io/aidea-zotero/ko/">https://visterainer.github.io/aidea-zotero/ko/</a>
</p>

**Zotero 7–10용 무료 오픈 소스 AI 도우미**

Zotero 사이드 패널에서 PDF나 EPUB를 읽으며 선택한 문단에 관해 질문하세요. 답변의 페이지 또는 장 인용을 눌러 원문을 확인하고 답변을 Zotero 노트로 저장할 수 있습니다. PDF는 한 편씩 또는 일괄 번역해 번역문 전용이나 원문 대조 PDF로 내보낼 수 있습니다.

## AIdea 설치

1. [최신 릴리스](https://github.com/Visterainer/aidea-zotero/releases/latest)에서 **AIdea .xpi 파일**을 내려받습니다.
2. Zotero의 **도구 → 플러그인**에서 톱니바퀴 메뉴를 열고 파일에서 플러그인 설치를 선택합니다. 내려받은 파일을 선택한 뒤 Zotero를 다시 시작합니다.
3. **Zotero 설정 → AIdea**에서 모델을 연결합니다. PDF나 EPUB를 열고 AIdea 사이드 패널에서 질문합니다.

## 모델 연결

- **ChatGPT** — OpenAI 카드의 환경 설치 버튼으로 독립 실행형 Codex CLI를 설치합니다. OAuth로 로그인한 뒤 모델 목록을 새로 고칩니다.
- **GitHub Copilot** — Copilot 카드에서 OAuth 로그인을 시작하고 브라우저에서 장치 코드를 확인해 승인합니다. Zotero로 돌아와 모델 목록을 새로 고칩니다.
- **호환 API 또는 로컬 모델** — API 기본 URL과 모델 ID를 입력합니다. 서비스에서 인증을 요구하면 API 키도 입력합니다. 로컬 Ollama의 일반적인 주소는 `http://localhost:11434/v1`입니다.

PDF 전체 번역을 처음 실행하기 전에 **번역** 탭에서 번역 환경을 설치하거나 업데이트합니다. 대화와 선택 영역 번역에는 모델 연결만 필요합니다.

## 핵심 기능

- Zotero 라이브러리 화면과 PDF 및 EPUB 리더에서 사용하는 **사이드 패널 AI 대화**
- PDF 선택 구간, EPUB 2/3 출판 구조, 스크린샷, 도표, 첨부 파일을 활용하는 **문서 맥락 기반 분석**
- 요약, 설명, 번역 등에 사용할 수 있는 **빠른 작업 버튼**
- OAuth 로그인과 OpenAI 호환 API 모드를 포함한 **다양한 연결 방식**
- Zotero 내부에서 실행하고 PDF로 내보낼 수 있는 **전체 논문 번역**
- PDF 또는 EPUB 리더에서 실행되며 문서 형식을 자동으로 감지하는 **선택 영역 번역**, 제한된 문서 맥락 사용 및 Zotero 노트 추가 지원
- 라이브러리 단위 분리, 노트 저장, 대화 지속성을 지원하는 **로컬 기록과 메모리**
- Markdown, 코드 블록, 표, LaTeX, 스트리밍 응답을 지원하는 **풍부한 렌더링**

## 스크린샷

### 사이드 패널 대화

<p align="center">
  <img src="../../doc/screenshots/chat_panel_en.png" alt="Zotero 안의 AIdea 사이드 패널 대화" width="900" />
</p>

### 전체 논문 번역

<p align="center">
  <img src="../../doc/screenshots/translate_panel_en.png" alt="AIdea 전체 논문 번역 패널" width="900" />
</p>

### 선택 영역 번역

<p align="center">
  <img src="../../doc/screenshots/selection_translation_popup.png" alt="PDF 리더 선택 영역 번역 팝업" width="900" />
</p>

<p align="center">
  <img src="../../doc/screenshots/selection_translation_settings.png" alt="AIdea 선택 영역 번역 설정" width="900" />
</p>

### 제공자 및 모델 설정

<p align="center">
  <img src="../../doc/screenshots/settings_oauth_models_en.png" alt="AIdea 제공자 및 모델 설정" width="900" />
</p>

## 개인정보 및 데이터 처리

- OAuth 토큰은 로컬 장치에 저장됩니다.
- API 요청은 선택한 제공자 또는 직접 설정한 엔드포인트로 바로 전송됩니다.
- 대화 기록과 메모리 정보는 Zotero 로컬 SQLite 데이터베이스에 저장됩니다.
- 프로젝트는 중계 서비스를 운영하지 않으며 사용 텔레메트리도 수집하지 않습니다.

## 개발

```bash
npm install
npm start
npm run build
npm run test:unit
```

## 라이선스 및 고지

AIdea는 [AGPL-3.0-or-later](../../LICENSE) 조건으로 배포됩니다。

이 프로젝트는 [llm-for-zotero](https://github.com/yilewang/llm-for-zotero)를 바탕으로 발전했습니다. 서드파티 고지는 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) 를 참조하십시오.

## ⭐ Star History

<a href="https://star-history.com/#Visterainer/aidea-zotero&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Visterainer/aidea-zotero&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Visterainer/aidea-zotero&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Visterainer/aidea-zotero&type=Date" />
 </picture>
</a>
