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

AIdea는 Zotero를 위한 무료 오픈소스 AI 연구 보조 플러그인입니다. 🔐 OpenAI (ChatGPT), Google Gemini, GitHub Copilot의 OAuth 로그인에 대응합니다. ⚙️ 또한 OpenAI 호환 API와 Ollama, LM Studio, vLLM 같은 환경을 통한 로컬 또는 자체 호스팅 모델 연결도 지원합니다. 여러 제공자 기반 대화, 문서 맥락 분석, 노트 내보내기, 메모리 기능, 전체 논문 번역을 Zotero 라이브러리 화면과 PDF 및 EPUB 리더 안으로 통합합니다.

<p align="center">
  <img alt="OpenAI ChatGPT" src="https://img.shields.io/badge/OpenAI-ChatGPT-10A37F?style=for-the-badge&logo=openai&logoColor=white" />
  <img alt="Google Gemini" src="https://img.shields.io/badge/Google-Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img alt="GitHub Copilot" src="https://img.shields.io/badge/GitHub-Copilot-111111?style=for-the-badge&logo=github&logoColor=white" />
</p>

<p align="center">
  <img alt="OpenAI Compatible API" src="https://img.shields.io/badge/OpenAI-Compatible%20API-4B5563?style=flat-square&logo=openai&logoColor=white" />
  <img alt="Ollama" src="https://img.shields.io/badge/Ollama-1F2937?style=flat-square&logoColor=white" />
  <img alt="LM Studio" src="https://img.shields.io/badge/LM%20Studio-2563EB?style=flat-square&logoColor=white" />
  <img alt="vLLM" src="https://img.shields.io/badge/vLLM-7C3AED?style=flat-square&logoColor=white" />
</p>

## 개요

AIdea는 논문과 전자책 읽기, 후속 질문, 발췌, 노트 정리, 선택 영역 번역, 전체 논문 번역을 Zotero 안에서 끝내고 싶은 연구자를 위해 설계되었습니다. Zotero 라이브러리 화면과 PDF 및 EPUB 리더에 일관된 AI 작업 공간을 추가해 외부 도구 사이를 오가는 부담을 줄입니다.

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

## 지원하는 연결 방식

| 방식                   | 인증                               | 설명                                                     |
| ---------------------- | ---------------------------------- | -------------------------------------------------------- |
| OpenAI (ChatGPT)       | Codex CLI 기반 OAuth               | 필요할 경우 플러그인이 Node.js 실행 환경을 자동으로 설치 |
| Google Gemini          | 플러그인 내부 OAuth (PKCE)         | 필요할 경우 플러그인이 Node.js 실행 환경을 자동으로 설치 |
| GitHub Copilot         | 플러그인 내부 OAuth (Device Code)  | 추가 Node.js 부트스트랩 불필요                           |
| OpenAI 호환 엔드포인트 | API Base URL, 모델, 선택적 API Key | 로컬, 자체 호스팅, 서드파티 호환 서비스에 적합           |

## 설치

### 요구 사항

- Zotero 7 이상
- Node.js 는 선택한 제공자가 필요할 때만 사용하며, 지원되는 흐름에서는 AIdea가 자동 설치 가능

### 플러그인 설치

1. [Releases](https://github.com/Visterainer/aidea-zotero/releases) 에서 최신 `.xpi` 패키지를 내려받습니다.
2. Zotero에서 `Tools` -> `Add-ons` 를 엽니다.
3. 톱니 메뉴에서 `Install Add-on From File...` 를 선택합니다.
4. 내려받은 `.xpi` 파일을 선택합니다.
5. Zotero를 다시 시작합니다.

### 업그레이드

새 `.xpi` 패키지를 기존 설치 위에 그대로 설치하면 됩니다. AIdea는 로컬 설정, 대화 기록, 메모리 데이터를 유지합니다.

## 빠른 시작

1. `Tools` -> `Add-ons` -> `AIdea` -> `Settings` 를 엽니다.
2. OAuth 로그인 또는 API 모드를 선택합니다.
3. 사용 가능한 모델을 새로고침하고 사용할 모델을 선택합니다.
4. Zotero 항목, PDF 또는 EPUB를 열고 AIdea 사이드 패널에서 작업을 시작합니다.

전체 논문 번역은 번역 탭으로 이동해 모델과 출력 경로를 설정한 뒤 Zotero 안에서 바로 실행할 수 있습니다.

선택 영역 번역은 설정에서 기능을 켜고 모델을 선택한 뒤 PDF 또는 EPUB 리더에서 텍스트를 선택하면 사용할 수 있으며, AIdea가 현재 문서 형식을 자동으로 감지합니다. PDF는 처음 사용할 때 간단한 개요와 전문 용어 요약이 포함된 로컬 콜드 스타트 캐시를 만듭니다. EPUB는 선택한 텍스트를 기준으로 제한된 도서 맥락을 바로 사용하며 별도의 워밍업 요청을 실행하지 않습니다.

## 언어 지원

- **플러그인 UI:** English, 简体中文, 繁體中文, 日本語, 한국어, Français, Deutsch, Español, Русский, Português, العربية, हिन्दी
- **문서 및 프로젝트 웹사이트:** English, 简体中文, 繁體中文, 日本語, 한국어, Français

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
