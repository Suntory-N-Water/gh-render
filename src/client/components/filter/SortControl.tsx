import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/client/components/ui/toggle-group';

type SortKey = 'lastUpdatedAt' | 'stars' | 'updateCount';

type Props = {
  value: SortKey;
  onChange: (value: SortKey) => void;
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'lastUpdatedAt', label: '最近のトレンド' },
  { value: 'stars', label: 'スター数' },
  { value: 'updateCount', label: 'トレンド回数' },
];

export function SortControl({ value, onChange }: Props) {
  return (
    <div className='flex flex-col gap-1'>
      <span className='text-xs text-muted-foreground font-medium'>ソート</span>
      <ToggleGroup
        type='single'
        value={value}
        onValueChange={(v) => v && onChange(v as SortKey)}
        className='justify-start gap-1'
      >
        {SORT_OPTIONS.map((opt) => (
          <ToggleGroupItem
            key={opt.value}
            value={opt.value}
            size='sm'
            className='text-xs h-7 px-3'
          >
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
