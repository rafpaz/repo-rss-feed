# Repository Releases RSS

Generate an RSS feed that aggregates the latest major and minor releases from any set of GitHub repositories, with optional per-repository tracking for fix (patch) releases. The resulting `docs/feed.xml` file is compatible with GitHub Pages, making it easy to keep a public feed up to date.

## Requirements

- Node.js 18 or newer (for the built-in `fetch` implementation)
- Optional: `GITHUB_TOKEN` environment variable for higher GitHub API rate limits

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```
2. Add the repositories you want to track in [`repos.json`](repos.json). Each entry can be either:
   - A string with the `owner/name` slug.
   - An object with `slug`, optional `maxReleases`, and optional `includePatchReleases`.
3. Run the generator:

   ```bash
   npm run generate
   ```

4. Publish the `docs` directory through GitHub Pages. The feed will be available at `https://<username>.github.io/<repo>/feed.xml`.

## How It Works

- The script fetches releases from the GitHub REST API for each repository.
- Draft and pre-release entries are ignored.
- Only tags that follow semantic versioning are included. By default, releases with non-zero patch components are filtered out unless `includePatchReleases` is enabled for a repository.
- The latest releases are merged into a single RSS feed, sorted by publish date, and written to `docs/feed.xml`.
- The generator is written in TypeScript (`src/generate-feed.ts`) and compiles to `dist/generate-feed.js` during `npm run generate`.

## Configuration Reference

Example `repos.json`:

```json
{
  "repositories": [
    { "slug": "vercel/next.js", "maxReleases": 5 },
    { "slug": "facebook/react", "maxReleases": 5, "includePatchReleases": true },
    "nodejs/node"
  ]
}
```

- `slug`: Repository identifier in `owner/name` format.
- `maxReleases`: Maximum number of releases to keep per repository (defaults to `10`).
- `includePatchReleases`: Set to `true` to keep fix (patch) releases in addition to major/minor updates (defaults to `false`).

## Automation

- This repository ships with a scheduled workflow at [`.github/workflows/generate-feed.yml`](.github/workflows/generate-feed.yml) that runs every three hours (and on manual dispatch) to rebuild the feed and push changes with the built-in `GITHUB_TOKEN`.
- When using GitHub Pages, enable the "Deploy from `docs/`" option in your repository settings so the generated `feed.xml` is published automatically.

## License

Released under the [MIT License](LICENSE).
