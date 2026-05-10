import { Separator } from '@/client/components/ui/separator';
import { LanguageFilter } from './LanguageFilter';
import { SortControl } from './SortControl';

type SortKey = 'lastUpdatedAt' | 'stars' | 'updateCount';

type Props = {
  lang: string;
  sort: SortKey;
  languages: string[];
  onLangChange: (value: string) => void;
  onSortChange: (value: SortKey) => void;
};

export function FilterBar({
  lang,
  sort,
  languages,
  onLangChange,
  onSortChange,
}: Props) {
  return (
    <div className='flex flex-col gap-3 rounded-lg border bg-card p-3'>
      <LanguageFilter
        value={lang}
        languages={languages}
        onChange={onLangChange}
      />
      <Separator />
      <SortControl value={sort} onChange={onSortChange} />
    </div>
  );
}
