# Providers and Authentication

AIdea supports multiple providers and uses OAuth-based login flows so users can sign in with existing accounts.

## Overview

| Provider | Login Flow | Needs Env Install | Notes |
| --- | --- | --- | --- |
| OpenAI (ChatGPT) | OAuth via Codex CLI | Yes | Uses local environment setup |
| Google Gemini | In-plugin OAuth (PKCE) | Yes | Uses local environment setup |
| Qwen | Device Code | No | Login happens in browser with code copy flow |
| GitHub Copilot | Device Code | No | Login happens in browser with code copy flow |

## Recommended Setup Order

For each provider card:

1. `Install/Update Env`
2. `OAuth Login`
3. `Refresh Models`

For Qwen and GitHub Copilot, start from step 2.

## What Each Button Does

### Install/Update Env

Installs or updates the local runtime and CLI dependencies required by the provider flow. This is mainly relevant for OpenAI and Gemini.

### OAuth Login

Starts the provider login flow.

- OpenAI and Gemini open a browser-based sign-in flow.
- Qwen and GitHub Copilot show an authorization code, copy it for you, and guide you to the browser flow.

### Refresh Models

Loads the models currently available for the authenticated account. If login succeeds but models are missing, this is the first thing to try.

### Remove Auth

Clears the saved local authentication state for that provider.

## Security Notes

- Tokens are stored locally
- API communication goes directly to the provider
- The plugin does not rely on a separate AIdea-hosted backend for model traffic

## Troubleshooting

- If model list is empty, run `Refresh Models`
- If login appears stuck, remove auth and log in again
- If OpenAI or Gemini setup fails, rerun `Install/Update Env`
- If the provider account itself has no access to a model, the plugin cannot expose it
