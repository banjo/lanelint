import { DateUtil } from '../../../utils/dateUtil.ts';
import { getComments } from '../api/get-comments.ts';

export const CommentsList = ({ discussionId }: { discussionId: string }) => {
  const comments = getComments(discussionId);
  return (
    <ul>
      {comments.map((comment) => (
        <li key={comment.id}>
          {comment.body} <time>{DateUtil.format(comment.createdAt)}</time>
        </li>
      ))}
    </ul>
  );
};
