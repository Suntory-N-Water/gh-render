import { useCallback, useState } from 'react';
import { Header } from '@/client/components/header/Header';
import { FilterBar } from '@/client/components/filter/FilterBar';
import { RepositoryList } from '@/client/components/repository/RepositoryList';
import { useRepositories } from '@/client/hooks/useRepositories';
import { useDebounce } from '@/client/hooks/useDebounce';

type SortKey = 'lastUpdatedAt' | 'stars' | 'updateCount';

export default function App() {
  const [lang, setLang] = useState('all');
  const [sort, setSort] = useState<SortKey>('lastUpdatedAt');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { repositories, isLoading, hasNext, loadMore, languages } =
    useRepositories({ lang, sort, q: debouncedQuery });

  const handleReset = useCallback(() => {
    setQuery('');
    setLang('all');
    setSort('lastUpdatedAt');
  }, []);

  return (
    <div className='min-h-dvh bg-background'>
      <Header query={query} onQueryChange={setQuery} onReset={handleReset} />

      <main className='mx-auto max-w-5xl px-4 py-6 space-y-4'>
        <FilterBar
          lang={lang}
          sort={sort}
          languages={languages}
          onLangChange={setLang}
          onSortChange={setSort}
        />

        <RepositoryList
          repositories={repositories}
          isLoading={isLoading}
          hasNext={hasNext}
          query={debouncedQuery}
          onLoadMore={loadMore}
        />
      </main>
    </div>
  );
}
