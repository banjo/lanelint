import { apiClient } from '../../../lib/api-client.ts';

export interface Discussion {
  readonly id: string;
  readonly title: string;
  readonly price: number;
}

export const getDiscussion = (id: string) => apiClient.get<Discussion>(`/discussions/${id}`);
