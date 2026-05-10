import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import type { InferResponseType } from 'hono/client';
import { client } from '@/client/lib/api-client';

type ListResponse = InferResponseType<typeof client.api.repositories.$get, 200>;
type SearchResponse = InferResponseType<
  typeof client.api.repositories.search.$get,
  200
>;

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

  // フィルタ変化時に displayCount を render 中にリセット
  const [prevLang, setPrevLang] = useState(lang);
  const [prevSort, setPrevSort] = useState(sort);
  const [prevQ, setPrevQ] = useState(q);

  if (prevLang !== lang || prevSort !== sort || prevQ !== q) {
    setPrevLang(lang);
    setPrevSort(sort);
    setPrevQ(q);
    setDisplayCount(PAGE_SIZE);
  }

  const [searchResults, setSearchResults] = useState<Repository[]>([]);
  const [isSearchPending, startSearchTransition] = useTransition();

  const filteredRepositories = useMemo(
    () => applySort(applyLangFilter(pool, lang), sort),
    [pool, lang, sort],
  );

  const filteredSearchResults = useMemo(
    () => applySort(applyLangFilter(searchResults, lang), sort),
    [searchResults, lang, sort],
  );

  const languages = useMemo(
    () => [...new Set(pool.map((r) => r.language).filter(Boolean))].sort(),
    [pool],
  );

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

  useEffect(() => {
    if (!q) {
      return;
    }
    startSearchTransition(async () => {
      const res = await client.api.repositories.search.$get({ query: { q } });
      const data: SearchResponse = await res.json();
      setSearchResults(data.repositories);
    });
  }, [q]);

  const loadMore = useCallback(() => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  }, []);

  const repositories = q
    ? filteredSearchResults
    : filteredRepositories.slice(0, displayCount);

  const hasNext = q ? false : displayCount < filteredRepositories.length;

  return {
    repositories,
    isLoading: isLoading || (q ? isSearchPending : false),
    hasNext,
    loadMore,
    languages,
  };
}
