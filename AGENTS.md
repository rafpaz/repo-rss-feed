# Repository Guidelines

## Project Structure & Module Organization
The generator logic lives in `src/generate-feed.ts`, written in TypeScript and targeting Node.js 18+. Compiled JavaScript is emitted to `dist/` via the TypeScript compiler; do not hand-edit files there. Generated RSS output is written to `docs/feed.xml`, which is published by the GitHub Pages workflow in `.github/workflows/generate-feed.yml`. Repository configuration for tracked projects resides in `repos.json` and should remain small and declarative.

## Build, Test, and Development Commands
Run installs with `npm install` before making changes. Use `npm run build` to invoke `tsc` and confirm the codebase still compiles. `npm run generate` performs a build and executes the generator, refreshing `docs/feed.xml`. Clean compiled assets with `npm run clean` when you need a fresh build. These commands are expected to finish without warnings before you open a pull request.

## Coding Style & Naming Conventions
Follow the existing two-space indentation and prefer single quotes, matching the current TypeScript file. Keep modules small: reusable helpers belong near the top of `src/` and should export clear, imperative-function names (for example, `fetchReleasesForRepo`). Use camelCase for variables and PascalCase for interfaces or types. Rely on `tsc` for type safety and avoid introducing additional formatters unless you wire them up in `package.json`.

## Testing Guidelines
There is no automated testing framework yet, so use `npm run build` as a quick regression check and rerun `npm run generate` against representative entries in `repos.json`. Inspect the updated `docs/feed.xml` to ensure release ordering and metadata look correct. When adding logic that can be unit-tested, include lightweight TypeScript tests under a new `src/__tests__/` directory and document the command needed to run them.

## Commit & Pull Request Guidelines
The repository has no formal history yet; adopt Conventional Commits (`feat:`, `fix:`, `docs:`) so future automation can parse change types. Keep the summary line under 72 characters and explain user-facing effects in the body, including references to issues. Pull requests should describe the change, list manual verification steps (command output or feed snippets), and mention whether `docs/feed.xml` needs to be regenerated. Add screenshots only when altering documentation or workflow behavior.

## Security & Configuration Tips
Never commit personal access tokens. Use the `GITHUB_TOKEN` environment variable locally when testing rate-limited scenarios and revoke it after use. Review `repos.json` for accidental private repositories before merging. If you introduce new configuration files, document required secrets in the README and sanitize default values.
