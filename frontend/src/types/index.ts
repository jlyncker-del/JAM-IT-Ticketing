export type UserRole = "CUSTOMER" | "AGENT" | "ADMIN";
export type TicketStatus = "DRAFT" | "NEW" | "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "WAITING_FOR_CUSTOMER" | "WAITING_FOR_THIRD_PARTY" | "RESOLVED" | "CLOSED" | "CANCELLED" | "MERGED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface User { id: string; firstName: string; lastName: string; email: string; role: UserRole; phone?: string; company?: string; department?: string; position?: string; isActive: boolean; lastLoginAt?: string; createdAt: string }
export interface Category { id: string; name: string; description?: string; icon?: string; defaultPriority: TicketPriority; isActive: boolean; _count?: { tickets: number } }
export interface Attachment { id: string; originalName: string; mimeType: string; fileSize: number; attachmentType: "IMAGE" | "LOG" | "DOCUMENT" | "ARCHIVE"; visibility: "PUBLIC" | "INTERNAL"; scanStatus: string }
export interface Comment { id: string; content: string; isInternal: boolean; createdAt: string; updatedAt: string; author: Pick<User, "id" | "firstName" | "lastName" | "role">; attachments: Attachment[] }
export interface Ticket {
  id: string; ticketNumber: string; subject: string; description: string; status: TicketStatus; priority: TicketPriority; source: string; createdAt: string; updatedAt: string;
  firstResponseDueAt?: string; resolutionDueAt?: string; firstRespondedAt?: string; resolvedAt?: string; closedAt?: string; customerRating?: number; customerFeedback?: string;
  category: Category; customer?: Pick<User, "id" | "firstName" | "lastName" | "email" | "phone" | "company">; assignedAgent?: Pick<User, "id" | "firstName" | "lastName" | "email">; assignedTeam?: { id: string; name: string };
  tags?: Array<{ tag: { id: string; name: string; color: string } }>;
  comments?: Comment[]; attachments?: Attachment[]; links?: Array<{ id: string; url: string; title?: string; description?: string; createdById: string }>; history?: Array<{ id: string; action: string; field?: string; oldValue?: string; newValue?: string; createdAt: string; changedBy: { firstName: string; lastName: string } }>;
  _count?: { attachments: number; comments: number };
}
export interface ApiResponse<T> { success: boolean; message?: string; data: T }
export interface PaginatedResponse<T> extends ApiResponse<T[]> { pagination: { page: number; limit: number; totalItems: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean } }
export interface DashboardSummary { total: number; open: number; inProgress: number; waiting: number; resolved: number; closed: number; critical: number; unassigned: number; slaBreached: number; slaWarning: number; unread: number; averageRating: number; ratingCount: number; averageFirstResponseMinutes: number; averageResolutionMinutes: number; recent: Ticket[] }
