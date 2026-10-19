import { CommentsList } from '../../features/comments/components/comments-list.tsx';
import { DiscussionCard } from '../../features/discussions/components/discussion-card.tsx';

export const DiscussionsRoute = () => (
  <DiscussionCard id="1" comments={<CommentsList discussionId="1" />} />
);
