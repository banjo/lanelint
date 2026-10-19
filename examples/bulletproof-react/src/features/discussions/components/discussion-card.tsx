import type { ReactNode } from 'react';
import { Button } from '../../../components/ui/button.tsx';
import { PriceUtil } from '../../../utils/priceUtil.ts';
import { getDiscussion } from '../api/get-discussion.ts';

export const DiscussionCard = ({ id, comments }: { id: string; comments: ReactNode }) => {
  const discussion = getDiscussion(id);
  return (
    <article>
      <h2>{discussion.title}</h2>
      <p>{PriceUtil.format(discussion.price)}</p>
      {comments}
      <Button>Reply</Button>
    </article>
  );
};
