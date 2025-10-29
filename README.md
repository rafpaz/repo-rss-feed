# Major & Minor Releases RSS

Generate an RSS feed that aggregates the latest major and minor releases from any set of GitHub repositories. The resulting `docs/feed.xml` file is compatible with GitHub Pages, making it easy to keep a public feed up to date.

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
   - An object with `slug` and optional `maxReleases`.
3. Run the generator:

   ```bash
   npm run generate
   ```

4. Publish the `docs` directory through GitHub Pages. The feed will be available at `https://<username>.github.io/<repo>/feed.xml`.

## How It Works

- The script fetches releases from the GitHub REST API for each repository.
- Draft and pre-release entries are ignored.
- Only tags that follow semantic versioning and have a `.0` patch component are included (e.g. `v2.1.0`, `1.9.0`).
- The latest releases are merged into a single RSS feed, sorted by publish date, and written to `docs/feed.xml`.
- The generator is written in TypeScript (`src/generate-feed.ts`) and compiles to `dist/generate-feed.js` during `npm run generate`.

## Configuration Reference

Example `repos.json`:

```json
{
  "repositories": [
    { "slug": "vercel/next.js", "maxReleases": 5 },
    { "slug": "facebook/react", "maxReleases": 5 },
    "nodejs/node"
  ]
}
```

- `slug`: Repository identifier in `owner/name` format.
- `maxReleases`: Maximum number of releases to keep per repository (defaults to `10`).

## Automation

- This repository ships with a scheduled workflow at [`.github/workflows/generate-feed.yml`](.github/workflows/generate-feed.yml) that runs every three hours (and on manual dispatch) to rebuild the feed and push changes with the built-in `GITHUB_TOKEN`.
- When using GitHub Pages, enable the "Deploy from `docs/`" option in your repository settings so the generated `feed.xml` is published automatically.

## License

Released under the [MIT License](LICENSE).
