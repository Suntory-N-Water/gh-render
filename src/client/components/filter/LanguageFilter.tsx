import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/client/components/ui/toggle-group';

type Props = {
  value: string;
  languages: string[];
  onChange: (value: string) => void;
};

export function LanguageFilter({ value, languages, onChange }: Props) {
  const options = ['all', ...languages];

  return (
    <div className='flex flex-col gap-1'>
      <span className='text-xs text-muted-foreground font-medium'>言語</span>
      <ToggleGroup
        type='single'
        value={value}
        onValueChange={(v) => v && onChange(v)}
        className='flex-wrap justify-start gap-1'
      >
        {options.map((lang) => (
          <ToggleGroupItem
            key={lang}
            value={lang}
            size='sm'
            className='text-xs h-7 px-3'
          >
            {lang === 'all' ? 'All' : lang}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
