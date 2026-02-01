export type User = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "user";
  createdAt: string;
  updatedAt: string;
};
