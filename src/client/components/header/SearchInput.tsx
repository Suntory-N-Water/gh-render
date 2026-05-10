import { Search, X } from 'lucide-react';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchInput({ value, onChange }: Props) {
  return (
    <div className='relative w-full'>
      <Search
        size={16}
        className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none'
      />
      <Input
        type='text'
        placeholder='リポジトリを検索...'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='pl-9 pr-8'
      />
      {value && (
        <Button
          variant='ghost'
          size='icon'
          aria-label='検索をクリア'
          onClick={() => onChange('')}
          className='absolute right-1 top-1/2 -translate-y-1/2 size-6'
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}
