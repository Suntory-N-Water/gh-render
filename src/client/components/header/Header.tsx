import { TrendingUp } from 'lucide-react';
import { Button } from '@/client/components/ui/button';
import { SearchInput } from './SearchInput';

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  onReset: () => void;
};

export function Header({ query, onQueryChange, onReset }: Props) {
  return (
    <header className='sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm'>
      <div className='mx-auto max-w-5xl px-4 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:py-3'>
        <Button
          variant='ghost'
          onClick={onReset}
          aria-label='ホームに戻る'
          className='flex items-center gap-2 px-2 self-start'
        >
          <TrendingUp size={20} className='text-primary' />
          <span className='font-semibold text-sm'>GitHub Trending</span>
        </Button>
        <div className='w-full sm:w-auto sm:max-w-sm'>
          <SearchInput value={query} onChange={onQueryChange} />
        </div>
      </div>
    </header>
  );
}
