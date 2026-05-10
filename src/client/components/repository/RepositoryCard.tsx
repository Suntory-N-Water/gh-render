import { Card, CardContent, CardHeader } from '@/client/components/ui/card';
import type { Repository } from '@/client/hooks/useRepositories';
import { RepositoryCardHeader } from './RepositoryCardHeader';
import { RepositoryCardStats } from './RepositoryCardStats';
import { RepositoryCardSummary } from './RepositoryCardSummary';

type Props = {
  repository: Repository;
};

export function RepositoryCard({ repository }: Props) {
  return (
    <Card>
      <CardHeader className='pb-2 gap-1'>
        <RepositoryCardHeader
          url={repository.url}
          language={repository.language}
        />
        <RepositoryCardStats
          stars={repository.stars}
          updateCount={repository.updateCount}
        />
      </CardHeader>
      <CardContent>
        <RepositoryCardSummary
          summary={repository.summary}
          detailedSummary={repository.detailedSummary}
        />
      </CardContent>
    </Card>
  );
}
