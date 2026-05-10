import { SearchX } from 'lucide-react';

type Props = {
  query: string;
};

export function EmptyState({ query }: Props) {
  return (
    <div className='flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground'>
      <SearchX size={40} strokeWidth={1.5} />
      <p className='text-sm'>
        {query
          ? `"${query}" に一致するリポジトリが見つかりません`
          : 'リポジトリがありません'}
      </p>
    </div>
  );
}
