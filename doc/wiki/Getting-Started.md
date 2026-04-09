# Getting Started

This page walks through the shortest path from installation to your first successful AI chat in Zotero.

## 1. Install AIdea

1. Download the latest release package from the repository Releases page.
2. In Zotero, open `Tools -> Add-ons`.
3. Click the gear menu and choose `Install Add-on From File...`.
4. Select the `.xpi` file and restart Zotero.

## 2. Open Settings

After restart, open the AIdea settings page from Zotero:

- `Tools -> Add-ons -> AIdea -> Settings`
- On some setups: `Edit -> Settings -> AIdea`

## 3. Set Up One Provider

On a provider card, the normal order is:

`Install/Update Env -> OAuth Login -> Refresh Models`

Notes:

- OpenAI and Gemini need the environment install step.
- Qwen and GitHub Copilot do not need extra runtime installation.
- After login, use `Refresh Models` so the plugin can load the models available to your account.

## 4. Open the AI Panel

You can use AIdea in two main places:

- Zotero library side panel
- PDF reader side panel

Select an item or open a PDF, then locate the AIdea panel on the right side.

## 5. Ask Your First Question

Try a simple prompt such as:

- "Summarize this paper in 5 bullet points."
- "Explain the core method in plain language."
- "What are the limitations mentioned by the authors?"

## 6. Add Grounded Context

When reading a PDF:

1. Select text in the reader.
2. Click `Add Text`.
3. Send a question about the selected passage.

This helps the model answer with direct grounding in the paper content.

## 7. Use Quick Actions

Quick actions are built-in shortcuts for common research tasks such as summarizing, translating, or extracting key points. You can customize them to match your workflow.

## If Something Does Not Work

- Check that the provider is logged in
- Run `Refresh Models`
- Confirm Zotero version is 7 or later
- Try reopening Zotero after setup
- See [[FAQ]]
