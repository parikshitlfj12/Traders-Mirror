export interface ProjectArchiveToggleProps {
  readonly projectId: string;
  readonly isActive: boolean;
}

export interface ProjectPatchResponse {
  data?: { project: { id: string; isActive: boolean } };
  error?: { message: string; code?: string };
}
