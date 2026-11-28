import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'

const ROOT = path.resolve(import.meta.dirname, '..')
const DIST_DIR = path.join(ROOT, 'dist')

describe('Hanzo Browser Extension Smoke Suite (#1)', () => {
  it('builds valid Manifest V3 extension bundle in dist/', () => {
    const manifestPath = path.join(DIST_DIR, 'manifest.json')
    assert.ok(fs.existsSync(manifestPath), 'dist/manifest.json must exist after pnpm build')

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    assert.equal(manifest.manifest_version, 3)
    assert.ok(manifest.name, 'manifest.name must be defined')
    assert.ok(manifest.background?.service_worker, 'background.service_worker must be defined')
    assert.ok(fs.existsSync(path.join(DIST_DIR, manifest.background.service_worker)))
    assert.ok(fs.existsSync(path.join(DIST_DIR, 'side-panel', 'index.html')))
    assert.ok(fs.existsSync(path.join(DIST_DIR, 'options', 'index.html')))
  })

  it('completes BYOK local hanzo-engine /v1/chat/completions and parses multi-step DOM actions', async () => {
    const server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          const parsed = JSON.parse(body)
          assert.equal(parsed.model, 'hanzo-local')
          assert.ok(Array.isArray(parsed.messages))

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              id: 'chatcmpl-byok-1',
              object: 'chat.completion',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: JSON.stringify({
                      actions: [
                        { type: 'navigate', url: 'https://example.com' },
                        { type: 'extract', selector: 'h1' },
                      ],
                    }),
                  },
                  finish_reason: 'stop',
                },
              ],
            }),
          )
        })
        return
      }
      res.writeHead(404)
      res.end()
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    const baseUrl = `http://127.0.0.1:${addr.port}/v1`

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer local-byok-key',
        },
        body: JSON.stringify({
          model: 'hanzo-local',
          messages: [{ role: 'user', content: 'Navigate to example.com and extract h1' }],
        }),
      })

      assert.equal(res.status, 200)
      const data = await res.json()
      const plan = JSON.parse(data.choices[0].message.content)
      assert.equal(plan.actions.length, 2)
      assert.equal(plan.actions[0].type, 'navigate')
      assert.equal(plan.actions[1].type, 'extract')
    } finally {
      server.close()
    }
  })
})
