import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const registry = 'https://registry.npmjs.org'
const run = (command, args, options = {}) =>
  execFileSync(command, args, { encoding: 'utf8', ...options }).trim()
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const integrity = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function validateVersion(version) {
  assert.equal(version, version.trim())
  assert.match(version, versionPattern, 'Use an exact X.Y.Z version')
}

export function validatePublication(record, published) {
  validateVersion(record.version)
  assert.equal(record.dryRun, false, 'A rehearsal cannot finalize')
  assert.match(record.commit, /^[a-f0-9]{40}$/)
  assert.equal(published.name, record.package, 'Published package differs')
  assert.equal(published.version, record.version, 'Published version differs')
  assert.equal(published.gitHead, record.commit, 'Published commit differs')
  assert.equal(published.dist?.integrity, record.integrity, 'Published tarball differs')
  assert.equal(
    published.dist?.attestations?.provenance?.predicateType,
    'https://slsa.dev/provenance/v1',
    'Published provenance is missing',
  )
}

export function validateRun(record, workflowRun, repository) {
  assert.equal(workflowRun.repository.full_name, repository)
  assert.equal(workflowRun.path, '.github/workflows/release.yml')
  assert.equal(workflowRun.event, 'workflow_dispatch')
  assert.equal(workflowRun.head_branch, 'main')
  assert.equal(workflowRun.status, 'completed')
  assert.equal(workflowRun.conclusion, 'success')
  assert.equal(workflowRun.head_sha, record.commit)
}

function readArtifact() {
  const record = json('.release/release.json')
  const pkg = json('package.json')
  assert.equal(record.package, pkg.name)
  validateVersion(record.version)
  assert.match(record.commit, /^[a-f0-9]{40}$/)
  assert.equal(
    integrity(fs.readFileSync('.release/package.tgz')),
    record.integrity,
    'Artifact checksum differs',
  )
  const packed = JSON.parse(run('tar', ['-xOf', '.release/package.tgz', 'package/package.json']))
  assert.equal(packed.name, record.package)
  assert.equal(packed.version, record.version)
  assert.equal(packed.gitHead, record.commit)
  assert.equal(
    packed.repository.url,
    `git+https://github.com/${process.env.GITHUB_REPOSITORY || pkg.repository.url.match(/github.com\/(.+)\.git$/)[1]}.git`,
  )
  return record
}

function pack() {
  const pkg = json('package.json')
  validateVersion(pkg.version)
  assert(!pkg.private)
  if (process.env.RELEASE_VERSION)
    assert.equal(pkg.version, process.env.RELEASE_VERSION, 'Requested version differs')
  const commit = run('git', ['rev-parse', 'HEAD'])
  assert.match(commit, /^[a-f0-9]{40}$/)
  if (process.env.RELEASE_DRY_RUN === 'false')
    assert.equal(
      run('git', ['diff', 'HEAD', '--', ...pkg.files, 'package.json', 'package-lock.json']),
      '',
      'Commit package changes before packing',
    )
  const notes = `releases/${pkg.version}.md`
  if (process.env.RELEASE_DRY_RUN === 'false') {
    assert(
      fs.existsSync(notes) && fs.readFileSync(notes, 'utf8').trim(),
      'Commit release notes before staging',
    )
    assert.equal(run('git', ['diff', 'HEAD', '--', notes]), '')
    run('git', ['ls-files', '--error-unmatch', notes])
  }
  fs.mkdirSync('.release', { recursive: true })
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-release-'))
  try {
    for (const file of [...pkg.files, 'README.md', 'LICENSE']) {
      assert(!path.isAbsolute(file) && !file.split('/').includes('..'))
      fs.mkdirSync(path.dirname(path.join(temporary, file)), { recursive: true })
      fs.copyFileSync(file, path.join(temporary, file))
    }
    fs.writeFileSync(
      path.join(temporary, 'package.json'),
      JSON.stringify({ ...pkg, gitHead: commit }, null, 2) + '\n',
    )
    const packed = JSON.parse(
      run(
        'npm',
        ['pack', '--ignore-scripts', '--json', '--pack-destination', path.resolve('.release')],
        { cwd: temporary },
      ),
    )[0]
    const expected = [...pkg.files, 'README.md', 'LICENSE', 'package.json'].sort()
    assert.deepEqual(
      packed.files.map((file) => file.path).sort(),
      expected,
      'Unexpected package contents',
    )
    fs.renameSync(path.join('.release', packed.filename), '.release/package.tgz')
    const record = {
      dryRun: process.env.RELEASE_DRY_RUN !== 'false',
      package: pkg.name,
      version: pkg.version,
      commit,
      integrity: integrity(fs.readFileSync('.release/package.tgz')),
    }
    fs.writeFileSync('.release/release.json', JSON.stringify(record, null, 2) + '\n')
    fs.writeFileSync(
      '.release/notes.md',
      fs.existsSync(notes) ? fs.readFileSync(notes) : `${pkg.description}\n`,
    )
    console.log(JSON.stringify(record, null, 2))
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}

async function publication(record) {
  const response = await fetch(
    `${registry}/${encodeURIComponent(record.package)}/${record.version}`,
    { signal: AbortSignal.timeout(30000) },
  )
  assert(response.ok, 'Published package could not be verified')
  validatePublication(record, await response.json())
}

async function available() {
  const record = readArtifact()
  assert.equal(record.dryRun, false)
  assert.equal(record.commit, process.env.GITHUB_SHA)
  repository()
  const response = await fetch(
    `${registry}/${encodeURIComponent(record.package)}/${record.version}`,
    { signal: AbortSignal.timeout(30000) },
  )
  assert.equal(response.status, 404, 'Version is already published or registry verification failed')
}

function github(endpoint, args = []) {
  try {
    return JSON.parse(run('gh', ['api', endpoint, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }))
  } catch (error) {
    if (error.status === 1 && /\(HTTP 404\)/.test(String(error.stderr))) return null
    throw error
  }
}

function repository() {
  const repo = process.env.GITHUB_REPOSITORY
  assert.match(repo, /^figma\/(plugin-typings|widget-typings|rest-api-spec)$/)
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main')
  return repo
}

async function finalize() {
  const repo = repository()
  const record = readArtifact()
  assert.equal(record.version, process.env.RELEASE_VERSION)
  const id = process.env.RELEASE_RUN_ID
  assert.match(id, /^\d+$/)
  const workflowRun = github(`repos/${repo}/actions/runs/${id}`)
  validateRun(record, workflowRun, repo)
  run('git', ['merge-base', '--is-ancestor', record.commit, 'origin/main'])
  const sourcePackage = JSON.parse(run('git', ['show', `${record.commit}:package.json`]))
  assert.equal(sourcePackage.name, record.package)
  assert.equal(sourcePackage.version, record.version)
  await publication(record)
  const tag = `v${record.version}`
  const ref = github(`repos/${repo}/git/ref/tags/${tag}`)
  if (ref) {
    run('git', ['fetch', 'origin', `refs/tags/${tag}`])
    assert.equal(
      run('git', ['rev-parse', 'FETCH_HEAD^{commit}']),
      record.commit,
      'Existing tag points elsewhere',
    )
  } else {
    github(`repos/${repo}/git/refs`, [
      '--method',
      'POST',
      '-f',
      `ref=refs/tags/${tag}`,
      '-f',
      `sha=${record.commit}`,
    ])
  }
  const release = github(`repos/${repo}/releases/tags/${tag}`)
  if (release) {
    assert.equal(release.draft, false, 'Existing release is a draft; review it manually')
    assert.equal(release.prerelease, false, 'Existing release is a prerelease; review it manually')
    console.log(release.html_url)
  } else {
    console.log(
      run('gh', [
        'release',
        'create',
        tag,
        '--repo',
        repo,
        '--verify-tag',
        '--title',
        `${record.package} ${record.version}`,
        '--notes-file',
        '.release/notes.md',
      ]),
    )
  }
}

async function main() {
  switch (process.argv[2]) {
    case 'pack':
      return pack()
    case 'verify':
      return readArtifact()
    case 'available':
      return available()
    case 'finalize':
      return finalize()
    default:
      throw new Error('Expected pack, verify, available, or finalize')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
