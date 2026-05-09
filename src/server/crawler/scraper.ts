import { parseHTML } from 'linkedom';
import type { TrendItem } from '../types';

/**
 * GitHubのトレンド情報を取得します。
 */
export async function fetchTrendingRepositories(
  targetLanguage?: string,
): Promise<TrendItem[]> {
  const url = targetLanguage
    ? `https://github.com/trending/${targetLanguage}`
    : 'https://github.com/trending';

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch trending page: ${response.statusText}`);
  }

  const html = await response.text();
  const { document } = parseHTML(html);

  const repos: TrendItem[] = [];
  const rows = Array.from(document.querySelectorAll('article.Box-row'));

  for (const row of rows) {
    const nameLink = row.querySelector('h2 a');
    const href = nameLink?.getAttribute('href');
    if (!href) {
      continue;
    }

    const name = href.startsWith('/') ? href.slice(1) : href;
    const repoUrl = `https://github.com${href}`;

    const descriptionElement = row.querySelector('p.col-9');
    const description = descriptionElement?.textContent?.trim() || '';

    const languageElement = row.querySelector(
      'span[itemprop="programmingLanguage"]',
    );
    const language = languageElement?.textContent?.trim() || 'Unknown';

    const starsLink = row.querySelector('a[href$="/stargazers"]');
    const starsText = starsLink?.textContent?.trim() || '0';
    const stars = Number.parseInt(starsText.replace(/,/g, ''), 10);

    const starsTodayElement = Array.from(row.querySelectorAll('span')).find(
      (span) => span.textContent?.includes('stars'),
    );
    const starsTodayText = starsTodayElement?.textContent?.trim() || '0';
    const starsTodayMatch = starsTodayText.match(/(\d+,?\d*)/);
    const starsToday = starsTodayMatch
      ? Number.parseInt(starsTodayMatch[1].replace(/,/g, ''), 10)
      : 0;

    repos.push({
      name,
      url: repoUrl,
      description,
      language,
      stars,
      starsToday,
    });
  }

  return repos;
}
