export type NotificationType = "success" | "error" | "info" | "warning";

export type NotificationSourceType =
  | "bill"
  | "appointment"
  | "contract"
  | "reminder";

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string | null;
  message: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
  sourceType: NotificationSourceType | null;
  sourceId: string | null;
};
