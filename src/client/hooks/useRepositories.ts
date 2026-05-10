import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

const INITIAL_LIMIT = 100;

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
  const [pool, setPool] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNext, setHasNext] = useState(false);
  const offsetRef = useRef(0);

  const [searchResults, setSearchResults] = useState<Repository[]>([]);
  const [isSearchPending, startSearchTransition] = useTransition();

  // ブラウズモード: pool に lang フィルタ + ソートを適用
  const filteredRepositories = useMemo(
    () => applySort(applyLangFilter(pool, lang), sort),
    [pool, lang, sort],
  );

  // 検索モード: 検索結果にも lang フィルタ + ソートを適用
  const filteredSearchResults = useMemo(
    () => applySort(applyLangFilter(searchResults, lang), sort),
    [searchResults, lang, sort],
  );

  const languages = useMemo(
    () => [...new Set(pool.map((r) => r.language).filter(Boolean))].sort(),
    [pool],
  );

  const fetchMore = useCallback(async (offset: number) => {
    setIsLoading(true);
    try {
      const res = await client.api.repositories.$get({
        query: { offset: String(offset), limit: String(INITIAL_LIMIT) },
      });
      const data: ListResponse = await res.json();
      setPool((prev) =>
        offset === 0 ? data.repositories : [...prev, ...data.repositories],
      );
      setHasNext(data.hasNext);
      offsetRef.current = offset + data.repositories.length;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMore(0);
  }, [fetchMore]);

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
    if (isLoading || !hasNext) {
      return;
    }
    void fetchMore(offsetRef.current);
  }, [isLoading, hasNext, fetchMore]);

  const repositories = q ? filteredSearchResults : filteredRepositories;

  return {
    repositories,
    isLoading: isLoading || (q ? isSearchPending : false),
    hasNext: q ? false : hasNext,
    loadMore,
    languages,
  };
}
