import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Markdown from 'react-markdown';
import { Button } from '@/client/components/ui/button';

type Props = {
  summary: string | null;
  detailedSummary: string | null;
};

export function RepositoryCardSummary({ summary, detailedSummary }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className='space-y-2'>
      <p className='text-sm leading-relaxed'>
        {summary ?? <span className='text-muted-foreground'>(要約なし)</span>}
      </p>

      {detailedSummary && (
        <>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 px-2 text-xs text-muted-foreground gap-1 cursor-pointer'
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                <ChevronUp size={14} />
                折りたたむ
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                詳細を見る
              </>
            )}
          </Button>

          <div
            className={`grid transition-all duration-200 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
          >
            <div className='overflow-hidden'>
              <div className='text-sm leading-relaxed text-muted-foreground border-l-2 pl-3 space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1 [&_h3:first-child]:mt-0 [&_ul]:pl-4 [&_ul]:list-disc [&_li]:leading-normal [&_p]:leading-relaxed'>
                <Markdown>{detailedSummary}</Markdown>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
