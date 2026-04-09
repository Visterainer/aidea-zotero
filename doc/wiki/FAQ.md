# FAQ

## Do I need an API key?

Usually no. AIdea is designed around OAuth login flows so you can use supported providers with your existing account.

## Which providers are supported?

OpenAI (ChatGPT), Google Gemini, Qwen, and GitHub Copilot.

## Do I need Node.js?

Only for some provider flows, mainly OpenAI and Gemini. The plugin can install the required environment automatically. Qwen and GitHub Copilot do not require this extra step.

## Where does my chat history live?

Chat history is stored locally in Zotero's database.

## Where are tokens stored?

Authentication data is stored locally on the user's machine.

## Does AIdea collect user data?

The project states that it does not collect user data and that API traffic goes directly between the user and the selected provider.

## Why can't I see models after login?

Try `Refresh Models` first. If that still does not work, remove auth and sign in again. Also verify that your provider account actually has access to the expected models.

## Why is the answer not grounded in the paper?

For the best results, select a passage in the PDF and use `Add Text` before asking a question about that section.

## Is this only for English papers?

No. AIdea supports both English and Chinese interfaces, and the workflows are useful for multilingual reading and translation tasks.

## Is AIdea open source?

Yes. The repository is public on GitHub under `AGPL-3.0-or-later`.
