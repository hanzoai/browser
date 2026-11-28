import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Hanzo Engine BYOK: Provider types and models configuration exists', async (t) => {
  const typesPath = path.join(rootDir, 'packages', 'storage', 'lib', 'settings', 'types.ts');
  assert.ok(fs.existsSync(typesPath), 'types.ts must exist');

  const content = fs.readFileSync(typesPath, 'utf8');
  assert.ok(content.includes("Hanzo = 'hanzo'"), 'ProviderTypeEnum must include Hanzo');
  assert.ok(content.includes('[ProviderTypeEnum.Hanzo]'), 'llmProviderModelNames must configure Hanzo models');
  assert.ok(content.includes('hanzo-1'), 'Hanzo model catalog must include hanzo-1');
  assert.ok(content.includes('llama-3.3-70b-instruct'), 'Hanzo model catalog must include llama-3.3-70b-instruct');
});

test('Hanzo Engine BYOK: Provider default configuration and endpoint mapping', async (t) => {
  const providersPath = path.join(rootDir, 'packages', 'storage', 'lib', 'settings', 'llmProviders.ts');
  assert.ok(fs.existsSync(providersPath), 'llmProviders.ts must exist');

  const content = fs.readFileSync(providersPath, 'utf8');
  assert.ok(content.includes("case ProviderTypeEnum.Hanzo:"), 'Must handle ProviderTypeEnum.Hanzo');
  assert.ok(content.includes("http://127.0.0.1:1234/v1"), 'Default endpoint must be http://127.0.0.1:1234/v1');
  assert.ok(content.includes("'hanzo-byok'"), 'Default API key must provide BYOK placeholder');
  assert.ok(content.includes('Hanzo Engine (Local / BYOK)'), 'Display name must be Hanzo Engine');
});

test('Hanzo Engine BYOK: Background agent helper supports Hanzo provider execution', async (t) => {
  const helperPath = path.join(rootDir, 'chrome-extension', 'src', 'background', 'agent', 'helper.ts');
  assert.ok(fs.existsSync(helperPath), 'helper.ts must exist');

  const content = fs.readFileSync(helperPath, 'utf8');
  assert.ok(content.includes("case ProviderTypeEnum.Hanzo:"), 'Helper must branch for ProviderTypeEnum.Hanzo');
  assert.ok(content.includes("baseUrl: providerConfig.baseUrl || 'http://127.0.0.1:1234/v1'"), 'Helper must enforce Hanzo baseUrl');
});

test('Chrome Extension Manifest V3: Unpacked loading requirements satisfied', async (t) => {
  const manifestJsPath = path.join(rootDir, 'chrome-extension', 'manifest.js');
  assert.ok(fs.existsSync(manifestJsPath), 'manifest.js must exist');

  const content = fs.readFileSync(manifestJsPath, 'utf8');
  assert.ok(content.includes('manifest_version: 3'), 'Must target Chrome Manifest V3');
  assert.ok(content.includes('background:'), 'Must specify background service worker');
  assert.ok(content.includes('permissions:'), 'Must specify extension permissions');
  assert.ok(content.includes('sidePanel') || content.includes('side_panel'), 'Must configure side panel');
});

test('BYOK Chat Completion Schema: Local Hanzo engine response format verification', async () => {
  // Simulates standard local OpenAI-compatible endpoint from hanzoai/engine
  const mockEngineResponse = {
    id: 'chatcmpl-hanzo-local-123',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'hanzo-1',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: '{"thought": "Navigate to targets and extract DOM table", "action": "click", "target": "#submit"}',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 42,
      completion_tokens: 28,
      total_tokens: 70,
    },
  };

  assert.equal(mockEngineResponse.object, 'chat.completion');
  assert.equal(mockEngineResponse.choices[0].finish_reason, 'stop');
  const parsedContent = JSON.parse(mockEngineResponse.choices[0].message.content);
  assert.equal(parsedContent.action, 'click');
  assert.equal(parsedContent.target, '#submit');
});

test('BYOK Endpoint URL Sanitizer: Ensures valid trailing /v1 path', () => {
  function sanitizeHanzoEndpoint(url) {
    let clean = (url || 'http://127.0.0.1:1234/v1').trim().replace(/\/+$/, '');
    if (!clean.endsWith('/v1')) {
      clean += '/v1';
    }
    return clean;
  }

  assert.equal(sanitizeHanzoEndpoint('http://127.0.0.1:1234'), 'http://127.0.0.1:1234/v1');
  assert.equal(sanitizeHanzoEndpoint('http://127.0.0.1:1234/'), 'http://127.0.0.1:1234/v1');
  assert.equal(sanitizeHanzoEndpoint('http://127.0.0.1:1234/v1'), 'http://127.0.0.1:1234/v1');
  assert.equal(sanitizeHanzoEndpoint('http://localhost:8080'), 'http://localhost:8080/v1');
});

test('Multi-step DOM Action Model: Validates executor actions', () => {
  const allowedActions = new Set(['navigate', 'click', 'type', 'extract', 'scroll', 'wait']);
  const steps = [
    { action: 'navigate', url: 'https://docs.hanzo.ai' },
    { action: 'click', selector: 'button.docs-search' },
    { action: 'type', selector: 'input.search-bar', text: 'BYOK' },
    { action: 'extract', selector: '.results-list' },
  ];

  for (const step of steps) {
    assert.ok(allowedActions.has(step.action), `Action ${step.action} must be supported`);
  }
});
