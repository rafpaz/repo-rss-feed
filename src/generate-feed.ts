#!/usr/bin/env node

/**
 * Generate an RSS feed containing major/minor release updates for configured repositories.
 *
 * Usage:
 *    npm run generate
 *
 * Environment:
 *    GITHUB_TOKEN (optional) – provides a higher rate limit when querying the GitHub API.
 *
 * Output:
 *    docs/feed.xml – ready for GitHub Pages.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { marked } from 'marked';

interface RepoConfig {
  slug: string;
  maxReleases?: number;
}

interface NormalizedRepoConfig {
  slug: string;
  maxReleases: number;
}

interface GitHubRelease {
  id: number;
  html_url: string;
  tag_name?: string;
  name?: string;
  body?: string;
  draft: boolean;
  prerelease: boolean;
  published_at?: string;
  created_at?: string;
}

interface FeedItem {
  repoSlug: string;
  htmlUrl: string;
  tagName: string;
  publishedAt: string | undefined;
  descriptionHtml: string;
  id: string;
  name: string;
}

interface RepoListConfig {
  repositories: Array<string | RepoConfig>;
}

const CONFIG_FILE = path.resolve(__dirname, '..', 'repos.json');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'docs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'feed.xml');

const SITE_TITLE = 'Major & Minor Releases Feed';
const SITE_DESCRIPTION =
  'Aggregated RSS feed with the latest major/minor releases from selected GitHub repositories.';
// Replace once published with the GitHub Pages URL.
const SITE_LINK = 'https://example.com/rss';
const SITE_LANGUAGE = 'en';
const SITE_TTL = 180;
const SITE_GENERATOR = 'repo-rss generator';

const DEFAULT_MAX_RELEASES_PER_REPO = 10;

async function loadRepoList(): Promise<Array<string | RepoConfig>> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as RepoListConfig;

    if (!parsed || !Array.isArray(parsed.repositories)) {
      throw new Error('Config must contain a "repositories" array.');
    }

    return parsed.repositories;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read repository config from ${CONFIG_FILE}: ${message}`);
  }
}

function parseConfigEntry(entry: string | RepoConfig): NormalizedRepoConfig {
  if (typeof entry === 'string') {
    return { slug: entry, maxReleases: DEFAULT_MAX_RELEASES_PER_REPO };
  }

  if (entry && typeof entry.slug === 'string') {
    return {
      slug: entry.slug,
      maxReleases: entry.maxReleases ?? DEFAULT_MAX_RELEASES_PER_REPO,
    };
  }

  throw new Error(`Invalid repository entry: ${JSON.stringify(entry)}`);
}

async function fetchReleasesForRepo({
  slug,
  maxReleases,
}: NormalizedRepoConfig): Promise<FeedItem[]> {
  const [owner, repo] = slug.split('/');
  if (!owner || !repo) {
    throw new Error(`Repository slug "${slug}" must be in "owner/name" format.`);
  }

  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/releases`);
  url.searchParams.set('per_page', String(Math.min(maxReleases * 2, 50)));

  const headers: Record<string, string> = {
    'User-Agent': 'repo-rss-generator',
    Accept: 'application/vnd.github+json',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API request failed for ${slug}: ${response.status} ${response.statusText}`);
  }

  const releases = (await response.json()) as GitHubRelease[];
  if (!Array.isArray(releases)) {
    throw new Error(`Unexpected response format for ${slug}`);
  }

  return releases
    .filter((release) => !release.draft && !release.prerelease)
    .filter((release) => isMajorOrMinorRelease(release.tag_name))
    .slice(0, maxReleases)
    .map((release) => ({
      repoSlug: slug,
      htmlUrl: release.html_url,
      tagName: release.tag_name ?? 'unknown',
      publishedAt: release.published_at ?? release.created_at,
      descriptionHtml: renderMarkdownToHtml(release.body ?? ''),
      id: release.html_url ?? `${slug}@${release.tag_name}`,
      name: release.name ?? `${slug} ${release.tag_name}`,
    }));
}

function isMajorOrMinorRelease(tag: string | undefined): boolean {
  if (!tag) {
    return false;
  }

  const semverRegex =
    /^v?(?<major>\d+)\.(?<minor>\d+)(?:\.(?<patch>\d+))?(?<suffix>[-+].*)?$/;
  const match = tag.match(semverRegex);
  if (!match || !match.groups) {
    return false;
  }

  const { major, minor, patch } = match.groups as {
    major: string;
    minor: string;
    patch?: string;
  };

  const majorNumber = Number(major);
  const minorNumber = Number(minor);
  const patchNumber = patch ? Number(patch) : 0;

  if (![majorNumber, minorNumber, patchNumber].every(Number.isInteger)) {
    return false;
  }

  return patchNumber === 0;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRssDate(isoDate?: string): string {
  const date = isoDate ? new Date(isoDate) : new Date();
  return date.toUTCString();
}

function renderMarkdownToHtml(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return '';
  }

  const html = marked.parse(trimmed) as string;
  return html.trim();
}

function wrapInCdata(tagName: string, value: string): string {
  const safeValue = value.replace(/\]\]>/g, ']]]]><![CDATA[>');
  return `<${tagName}><![CDATA[${safeValue}]]></${tagName}>`;
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSummary(html: string): string {
  const fallback = 'No release notes provided.';
  if (!html) {
    return fallback;
  }

  const text = stripHtmlTags(html);
  if (!text) {
    return fallback;
  }

  const MAX_LENGTH = 300;
  if (text.length <= MAX_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_LENGTH - 3).trim()}...`;
}

function buildFeedUrl(siteLink: string): string {
  const normalized = siteLink.endsWith('/') ? siteLink : `${siteLink}/`;
  return `${normalized}feed.xml`;
}

function buildRssFeed(items: FeedItem[]): string {
  const feedUrl = buildFeedUrl(SITE_LINK);
  const feedItems = items
    .sort(
      (a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime(),
    )
    .map((item) => {
      const title = `${item.repoSlug} ${item.tagName}`;
      const summary = buildSummary(item.descriptionHtml);
      const descriptionElement = `<description>${escapeXml(summary)}</description>`;
      const contentHtml = item.descriptionHtml || '<p>No release notes provided.</p>';
      const contentElement = wrapInCdata('content:encoded', contentHtml);
      const [owner, repo] = item.repoSlug.split('/');
      const repoUrl = `https://github.com/${item.repoSlug}`;

      return [
        '    <item>',
        `      <title>${escapeXml(title)}</title>`,
        `      <link>${escapeXml(item.htmlUrl)}</link>`,
        `      <guid${item.id === item.htmlUrl ? ' isPermaLink="true"' : ' isPermaLink="false"'}>${escapeXml(item.id)}</guid>`,
        `      <pubDate>${escapeXml(formatRssDate(item.publishedAt))}</pubDate>`,
        `      ${descriptionElement}`,
        `      ${contentElement}`,
        owner ? `      <category>${escapeXml(owner)}</category>` : undefined,
        repo ? `      <category>${escapeXml(repo)}</category>` : undefined,
        `      <source url="${escapeXml(repoUrl)}">${escapeXml(item.repoSlug)}</source>`,
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"',
    '  xmlns:atom="http://www.w3.org/2005/Atom"',
    '  xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    '  <channel>',
    `    <title>${escapeXml(SITE_TITLE)}</title>`,
    `    <link>${escapeXml(SITE_LINK)}</link>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    `    <description>${escapeXml(SITE_DESCRIPTION)}</description>`,
    `    <language>${escapeXml(SITE_LANGUAGE)}</language>`,
    '    <docs>https://www.rssboard.org/rss-specification</docs>',
    `    <generator>${escapeXml(SITE_GENERATOR)}</generator>`,
    `    <lastBuildDate>${escapeXml(formatRssDate(new Date().toISOString()))}</lastBuildDate>`,
    `    <ttl>${SITE_TTL}</ttl>`,
    feedItems,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

async function ensureOutputDir(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function writeFeed(content: string): Promise<void> {
  await ensureOutputDir();
  await fs.writeFile(OUTPUT_FILE, content, 'utf8');
}

async function main(): Promise<void> {
  const rawEntries = await loadRepoList();
  const repositories = rawEntries.map(parseConfigEntry);

  const results: FeedItem[] = [];
  const errors: string[] = [];

  for (const repo of repositories) {
    try {
      const releases = await fetchReleasesForRepo(repo);
      results.push(...releases);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`- ${repo.slug}: ${message}`);
    }
  }

  if (results.length === 0) {
    console.warn('No major/minor releases found with current configuration.');
  }

  const feed = buildRssFeed(results);
  await writeFeed(feed);

  console.log(`RSS feed written to ${OUTPUT_FILE}`);

  if (errors.length > 0) {
    console.warn('Some repositories could not be processed:\n' + errors.join('\n'));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
