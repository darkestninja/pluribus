export type CampaignStatus = "draft" | "in_review" | "approved" | "delivered";

export interface ExportLogEntry {
  exportedAt: string;
  exportedBy: string;
  assetCount: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  thumbnail: string;
  lastEdited: string;
  type: "active" | "archived";
  athleteName?: string;
  athleteIds?: string[];
  recipeId?: string;
  status?: CampaignStatus;
  assetCount?: number;
  brief?: string;
  moodboardImages?: string[];
  exportLog?: ExportLogEntry[];
}

export const projects: Project[] = [];

export const archivedProjects: Project[] = [
];
