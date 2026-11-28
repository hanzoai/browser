import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = import.meta.dirname

test('chrome extension build: manifest.json and core bundles exist', () => {
  for (const rel of [
    'dist/manifest.json',
    'dist/background.iife.js',
    'dist/side-panel/index.html',
    'dist/options/index.html',
  ]) {
    assert.equal(existsSync(resolve(root, rel)), true, `Missing ${rel}`)
  }
  const manifest = JSON.parse(readFileSync(resolve(root, 'dist/manifest.json'), 'utf8'))
  assert.equal(manifest.manifest_version, 3)
  assert.ok(manifest.background?.service_worker, 'background service_worker present')
})
