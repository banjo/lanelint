import { apiClient } from '../../../lib/api-client.ts';

export interface Comment {
  readonly id: string;
  readonly body: string;
  readonly createdAt: Date;
}

export const getComments = (discussionId: string) =>
  apiClient.get<Comment[]>(`/discussions/${discussionId}/comments`);
