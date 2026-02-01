export type Note = {
  id: string;
  content: string;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdBy: string;
  createdAt: string;
};
