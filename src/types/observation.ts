export type ObservationCategory =
  | "routine"
  | "mood"
  | "physical"
  | "home"
  | "other";

export type Observation = {
  id: string;
  content: string;
  category: ObservationCategory;
  observedAt: string;
  createdBy: string;
  createdAt: string;
};
