import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { InferResponseType } from 'hono/client';
import { client } from '@/client/lib/api-client';

type ListResponse = InferResponseType<typeof client.api.repositories.$get, 200>;

export type Repository = ListResponse['repositories'][number];

type SortKey = 'lastUpdatedAt' | 'stars' | 'updateCount';

type Params = {
  lang: string;
  sort: SortKey;
  q: string;
};

const PAGE_SIZE = 20;

// remount で再フェッチしないためのモジュールレベルキャッシュ
let poolCache: Repository[] = [];
let didFetch = false;

function applySearch(repos: Repository[], q: string): Repository[] {
  if (!q) {
    return repos;
  }
  const lower = q.toLowerCase();
  return repos.filter(
    (r) =>
      r.url.toLowerCase().includes(lower) ||
      r.description.toLowerCase().includes(lower) ||
      r.summary?.toLowerCase().includes(lower) ||
      r.detailedSummary?.toLowerCase().includes(lower),
  );
}

function applyLangFilter(repos: Repository[], lang: string): Repository[] {
  if (!lang || lang === 'all') {
    return repos;
  }
  return repos.filter((r) => r.language === lang);
}

function applySort(repos: Repository[], sort: SortKey): Repository[] {
  if (sort === 'stars') {
    return [...repos].sort((a, b) => b.stars - a.stars);
  }
  if (sort === 'updateCount') {
    return [...repos].sort((a, b) => b.updateCount - a.updateCount);
  }
  return repos;
}

export function useRepositories({ lang, sort, q }: Params) {
  const [pool, setPool] = useState<Repository[]>(poolCache);
  const [isLoading, setIsLoading] = useState(!didFetch);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const deferredQ = useDeferredValue(q);

  // フィルタ変化時に displayCount を render 中にリセット
  const [prevLang, setPrevLang] = useState(lang);
  const [prevSort, setPrevSort] = useState(sort);
  const [prevQ, setPrevQ] = useState(deferredQ);

  if (prevLang !== lang || prevSort !== sort || prevQ !== deferredQ) {
    setPrevLang(lang);
    setPrevSort(sort);
    setPrevQ(deferredQ);
    setDisplayCount(PAGE_SIZE);
  }

  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of pool) {
      const lang = r.language;
      if (lang && lang !== 'Unknown') {
        counts.set(lang, (counts.get(lang) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang);
  }, [pool]);

  useEffect(() => {
    if (didFetch) {
      return;
    }
    didFetch = true;
    setIsLoading(true);
    void client.api.repositories.$get().then(async (res) => {
      const data: ListResponse = await res.json();
      poolCache = data.repositories;
      setPool(data.repositories);
      setIsLoading(false);
    });
  }, []);

  const filtered = useMemo(
    () => applySort(applyLangFilter(applySearch(pool, deferredQ), lang), sort),
    [pool, deferredQ, lang, sort],
  );

  const loadMore = useCallback(() => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  }, []);

  const repositories = deferredQ ? filtered : filtered.slice(0, displayCount);
  const hasNext = deferredQ ? false : displayCount < filtered.length;

  return {
    repositories,
    isLoading,
    hasNext,
    loadMore,
    languages,
  };
}
