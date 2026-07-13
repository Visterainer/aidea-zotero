---
description: Build the Zotero plugin and deploy XPI to desktop
---

## Build & Deploy Workflow

// turbo-all

1. Build the plugin:

```
npm run build
```

2. Copy the built XPI to desktop:

```
Copy-Item "e:\OneDrive\业余工程\Zotero_LLM_Plugin\.scaffold\build\AIdea-*.xpi" "$env:USERPROFILE\Desktop\" -Force
```

**IMPORTANT**: Always copy the XPI to the desktop after every build. The user installs the plugin from the desktop copy.
