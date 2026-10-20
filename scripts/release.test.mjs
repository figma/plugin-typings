import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validatePublication, validateRun, validateVersion } from './release.mjs'

const record = {
  dryRun: false,
  package: '@figma/example',
  version: '1.2.3',
  commit: 'a'.repeat(40),
  integrity: 'sha512-example',
}
const publication = {
  name: record.package,
  version: record.version,
  gitHead: record.commit,
  dist: {
    integrity: record.integrity,
    attestations: { provenance: { predicateType: 'https://slsa.dev/provenance/v1' } },
  },
}
const workflowRun = {
  repository: { full_name: 'figma/example' },
  path: '.github/workflows/release.yml',
  event: 'workflow_dispatch',
  head_branch: 'main',
  status: 'completed',
  conclusion: 'success',
  head_sha: record.commit,
}

test('published artifact is accepted after approval', () => {
  validatePublication(record, publication)
  validateRun(record, workflowRun, 'figma/example')
})
test('unpublished and mismatched packages cannot finalize', () => {
  for (const change of [
    { name: '@other/example' },
    { version: '1.2.4' },
    { gitHead: 'b'.repeat(40) },
    { dist: { ...publication.dist, integrity: 'sha512-changed' } },
    { dist: { integrity: record.integrity } },
  ]) {
    assert.throws(() => validatePublication(record, { ...publication, ...change }))
  }
  assert.throws(() => validatePublication(record, {}))
})
test('failed, unrelated and branch runs cannot finalize', () => {
  for (const change of [
    { path: '.github/workflows/test.yml' },
    { event: 'pull_request' },
    { head_branch: 'other' },
    { conclusion: 'failure' },
    { status: 'in_progress' },
    { head_sha: 'b'.repeat(40) },
    { repository: { full_name: 'other/example' } },
  ]) {
    assert.throws(() => validateRun(record, { ...workflowRun, ...change }, 'figma/example'))
  }
})
test('ranges and dist-tags are not release versions', () => {
  for (const version of ['latest', '^1.2.3', '1.2', '01.2.3', '1.2.3\n', '1.2.3;echo bad'])
    assert.throws(() => validateVersion(version))
})

test('a rehearsal cannot authorize finalization', () => {
  assert.throws(() => validatePublication({ ...record, dryRun: true }, publication))
})
