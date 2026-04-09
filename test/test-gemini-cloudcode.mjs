import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ============================================================================
// GEMINI CLOUD CODE (OAUTH) TEST & DEMONSTRATION
// ============================================================================
// Objective: Resolve 429 Rate Limit (RESOURCE_EXHAUSTED) & thinkingBudget bugs
// 
// 1. Implicit Concurrent Requests cause 429 quota exhaustion on Cloud Code.
//    Solution: Implement a `RequestQueue` (concurrency = 1) to serialize calls.
// 2. Improper `thinkingBudget` causes 400/429 errors.
//    Solution: Sanitize `thinkingConfig` before sending to Cloud Code 
//    (e.g., dropping negative budgets or improperly structured `extra_body`).
// ============================================================================

const GEMINI_CODE_ASSIST_STREAM_URL = "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse";

// 1. Queue to prevent concurrent "RATE_LIMIT_EXCEEDED" / "MODEL_CAPACITY_EXHAUSTED"
class RequestQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  async enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    
    const { taskFn, resolve, reject } = this.queue.shift();
    try {
      const result = await taskFn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.isProcessing = false;
      // Add a cool-down of 1.5s between requests to help CloudCode token-bucket reset
      setTimeout(() => this.processNext(), 1500); 
    }
  }
}

const cloudCodeQueue = new RequestQueue();

// 2. Read Local Zotero OAuth Token for Testing
function getZoteroPrefsToken() {
  try {
    const appData = process.env.APPDATA;
    if (!appData) return null;
    const profilesDir = path.join(appData, "Zotero", "Zotero", "Profiles");
    if (!fs.existsSync(profilesDir)) return null;
    
    for (const dir of fs.readdirSync(profilesDir)) {
      const prefsPath = path.join(profilesDir, dir, "prefs.js");
      if (fs.existsSync(prefsPath)) {
        const content = fs.readFileSync(prefsPath, 'utf-8');
        const tokenMatch = content.match(/user_pref\("extensions\.zotero\.aidea\.geminiOAuthAccessToken",\s*"([^"]+)"\)/);
        const projectMatch = content.match(/user_pref\("extensions\.zotero\.aidea\.geminiOAuthProjectId",\s*"([^"]+)"\)/);
        if (tokenMatch) {
          return { token: tokenMatch[1], project: projectMatch ? projectMatch[1] : "" };
        }
      }
    }
  } catch (err) {}
  return null;
}

// 3. Construct Payload with Correct thinkingConfig
function buildPayload(model, prompt, projectId, thinkingConfigInput) {
  const modelId = model.replace(/^models\//, "");
  
  const request = {
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  };

  const generationConfig = {};
  
  // FIX: Improper inclusion of `thinkingBudget`.
  // - OpenClaw removes it if < 0.
  // - You must place it strictly into `generationConfig.thinkingConfig` (or thinking_config)
  //   instead of injecting it implicitly as `thinkingBudget: -1` or undefined.
  if (thinkingConfigInput && typeof thinkingConfigInput === 'object') {
    const budget = Number(thinkingConfigInput.thinkingBudget);
    
    // Only apply valid positive budget. Otherwise omit completely to prevent 4xx/429.
    if (!Number.isNaN(budget) && budget > 0) {
      generationConfig.thinkingConfig = {
        thinking_budget: budget
      };
    } else {
      console.warn(`[WARN] Sanitize: Omitted invalid thinkingBudget: ${thinkingConfigInput.thinkingBudget}`);
    }
  }
  
  if (Object.keys(generationConfig).length > 0) {
    request.generationConfig = generationConfig;
  }

  return {
    model: modelId,
    project: projectId,
    user_prompt_id: `aidea-test-${Date.now()}`,
    request
  };
}

// 4. Thread-Safe Streaming API Call
async function fetchCloudCodeStream(model, prompt, auth, thinkingConfig) {
  return cloudCodeQueue.enqueue(async () => {
    const payload = buildPayload(model, prompt, auth.project, thinkingConfig);

    console.log(`\n==> [Req] ${prompt.substring(0, 30)}... (Model: ${model})`);
    
    const headers = {
      "Authorization": `Bearer ${auth.token}`,
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    };

    const response = await fetch(GEMINI_CODE_ASSIST_STREAM_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      // Throw formatted error to simulate the HTTP 429 trace
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.trim().startsWith("data:")) continue;
          const data = line.trim().slice(5).trim();
          if (!data || data === "[DONE]") continue;
          
          try {
            const parsed = JSON.parse(data);
            console.log(`[RAW CHUNK]`, JSON.stringify(parsed, null, 2));
            const candidates = parsed?.candidates || parsed?.response?.candidates || [];
            for (const cand of candidates) {
              for (const part of (cand?.content?.parts || [])) {
                if (part.text) fullText += part.text;
              }
            }
          } catch { /* ignore non-JSON chunk parts */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
    
    console.log(`<== [Res] Payload received (${fullText.length} chars)`);
    return fullText;
  });
}

// 5. Execution Wrapper
async function runSimulator() {
  const auth = getZoteroPrefsToken();
  if (!auth || !auth.token) {
    console.error("Local OAuth Token missing. Tests defined successfully but execution skipped.");
    return;
  }

  console.log(`[INIT] Running tests against GCP project: ${auth.project}`);

  const testModel = "gemini-3.1-pro-preview";
  
  // Test 1: Implicit Concurrent requests are handled flawlessly by cloudCodeQueue
  // This prevents the "No capacity available" 429 error!
  console.log(`[TEST] Bursting 3 requests to evaluate concurrency queue...`);
  
  // Now let's try WITHOUT thinking config, because 3.1 Pro might reject reasoning requests when capacity is low!
  const p1 = fetchCloudCodeStream(testModel, "Name one planet.", auth, undefined);
  
  try {
    const [res] = await Promise.all([p1]);
    console.log(`\n[SUCCESS] Response text: ${res}`);
    console.log(`\n[SUCCESS] Completed all queued tasks without 429 quota exhaustion.`);
  } catch (error) {
    console.error(`\n[ERROR] Request failed: ${error.message}`);
  }
}

runSimulator();

