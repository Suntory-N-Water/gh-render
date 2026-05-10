import { ExternalLink } from 'lucide-react';
import { Badge } from '@/client/components/ui/badge';

type Props = {
  url: string;
  language: string;
};

function extractRepoName(url: string): string {
  const match = url.match(/github\.com\/(.+)/);
  return match ? match[1] : url;
}

export function RepositoryCardHeader({ url, language }: Props) {
  const name = extractRepoName(url);

  return (
    <div className='flex items-start justify-between gap-2 min-w-0'>
      <a
        href={url}
        target='_blank'
        rel='noopener noreferrer'
        className='flex items-center gap-1 font-semibold text-sm hover:underline min-w-0 flex-wrap'
      >
        <span className='break-all'>{name}</span>
        <ExternalLink size={12} className='shrink-0 text-muted-foreground' />
      </a>
      {language && (
        <Badge variant='outline' className='shrink-0 text-xs'>
          {language}
        </Badge>
      )}
    </div>
  );
}
