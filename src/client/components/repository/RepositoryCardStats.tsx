import { Star, TrendingUp } from 'lucide-react';

type Props = {
  stars: number;
  updateCount: number;
};

function formatStars(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return String(n);
}

export function RepositoryCardStats({ stars, updateCount }: Props) {
  return (
    <div className='flex items-center gap-4 text-xs text-muted-foreground tabular-nums'>
      <span className='flex items-center gap-1'>
        <Star size={12} />
        {formatStars(stars)}
      </span>
      <span className='flex items-center gap-1'>
        <TrendingUp size={12} />
        {updateCount}回
      </span>
    </div>
  );
}
