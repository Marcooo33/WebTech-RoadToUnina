/** Mirrors backend `UserProfileDto` (docs/api.md §3.2). */
export interface UserProfileDto {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

/** Mirrors backend `UserSummaryDto` (docs/api.md §3.1). */
export interface UserSummaryDto {
  id: string;
  username: string;
  avatarUrl: string | null;
}
