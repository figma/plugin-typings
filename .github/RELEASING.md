# Releasing @figma/plugin-typings

Prepare the package version and `releases/X.Y.Z.md` notes in a reviewed pull request.
Confirm the API changes are available to users before releasing.

1. Run `npm ci --ignore-scripts` and `npm run release:check`. This packs and tests
   the package without publishing. CI runs the same checks on pull requests.
2. After review and merge, run Release (`release.yml`) on `main` with the exact
   version and `dry_run=true`. Inspect the package artifact and test results.
3. When ready, run Release again with `dry_run=false`. A release maintainer
   approves the `npm-release` environment. The workflow stages the tested tarball.
4. A package maintainer reviews the staged package on npm and completes approval
   with 2FA. Record the successful Release run ID. If staging succeeded but a later
   step failed, inspect the existing npm stage before retrying.
5. Once the version is live, run Finalize Release (`finalize.yml`) on `main` with
   the version and Release run ID. It checks the npm package, provenance metadata,
   tarball integrity, and source commit before creating `vX.Y.Z` and the release.

Do not rename `release.yml` or its `npm-release` environment: npm trusted publishing
uses both identifiers. Staging runs directly in this workflow.

Finalization can be retried after a partial failure. It accepts an existing tag
only at the same commit and leaves an existing published release unchanged.
Artifacts expire after 90 days; finish the release within that window. If an
artifact is unavailable or verification fails, stop and ask a maintainer to
investigate. Do not move an existing version tag.
