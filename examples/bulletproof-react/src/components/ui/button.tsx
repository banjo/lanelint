import type { ReactNode } from 'react';

export const Button = ({ children }: { children: ReactNode }) => (
  <button type="button">{children}</button>
);
