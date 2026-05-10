import { useEffect, useRef } from 'react';
import type { Repository } from '@/client/hooks/useRepositories';
import { RepositoryCard } from './RepositoryCard';
import { SkeletonCard } from './SkeletonCard';
import { EmptyState } from './EmptyState';

type Props = {
  repositories: Repository[];
  isLoading: boolean;
  hasNext: boolean;
  query: string;
  onLoadMore: () => void;
};

const SKELETON_COUNT = 6;

export function RepositoryList({
  repositories,
  isLoading,
  hasNext,
  query,
  onLoadMore,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore]);

  if (!isLoading && repositories.length === 0) {
    return <EmptyState query={query} />;
  }

  return (
    <div className='space-y-4'>
      <div className='grid gap-4 sm:grid-cols-2'>
        {repositories.map((repo) => (
          <RepositoryCard key={repo.id} repository={repo} />
        ))}
        {isLoading &&
          Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: スケルトンは順序固定
            <SkeletonCard key={i} />
          ))}
      </div>

      {hasNext && !isLoading && <div ref={sentinelRef} className='h-1' />}
    </div>
  );
}
