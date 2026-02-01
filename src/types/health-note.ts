export type HealthNoteCategory =
  | "medication"
  | "gp-visit"
  | "hospital"
  | "general";

export type HealthNote = {
  id: string;
  title: string;
  content: string;
  category: HealthNoteCategory;
  date: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
