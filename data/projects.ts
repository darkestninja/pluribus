export interface Project {
  id: string;
  name: string;
  description?: string;
  thumbnail: string;
  lastEdited: string;
  type: "active" | "archived";
  athleteName?: string;
  athleteIds?: string[];
  workflowId?: string;
  status?: string;
  assetCount?: number;
}

export const projects: Project[] = [
  {
    id: "project-1",
    name: "Australian Dolphins Campaign",
    description: "Hero portraits for Swimming Australia's pre-Olympic press release.",
    thumbnail: "/projects/james-magnussen.jpg",
    lastEdited: "2h ago",
    type: "active",
    athleteIds: ["1"],
    workflowId: "wf-noir-studio",
    status: "In Progress",
    assetCount: 8,
  },
  {
    id: "project-2",
    name: "Team USA Track Series",
    description: "Announcement imagery for the sprint relay ahead of World Athletics.",
    thumbnail: "/projects/marvin-bracy.jpg",
    lastEdited: "5h ago",
    type: "active",
    athleteIds: ["2"],
    workflowId: "wf-daylight-action",
    status: "In Progress",
    assetCount: 4,
  },
  {
    id: "project-3",
    name: "Distance Freestyle Editorial",
    description: "Editorial shoot for Swim World Magazine cover consideration.",
    thumbnail: "/projects/megan-romano.jpg",
    lastEdited: "1 day ago",
    type: "active",
    athleteIds: ["3"],
    workflowId: "wf-noir-studio",
    status: "Review",
    assetCount: 12,
  },
  {
    id: "project-4",
    name: "World Weightlifting Series",
    description: "Victory podium portraits for IWF official media channels.",
    thumbnail: "/projects/juan-solis.jpg",
    lastEdited: "2 days ago",
    type: "active",
    athleteIds: ["4"],
    workflowId: "wf-victory-podium",
    status: "In Progress",
    assetCount: 6,
  },
  {
    id: "project-5",
    name: "Caribbean Sprint Profile",
    description: "Athlete announcement portraits for Barbados Olympic Committee.",
    thumbnail: "/projects/tristan-evelyn.jpg",
    lastEdited: "3 days ago",
    type: "active",
    athleteIds: ["5"],
    workflowId: "wf-daylight-action",
    status: "Complete",
    assetCount: 16,
  },
  {
    id: "project-6",
    name: "Group Editorial Series",
    description: "Multi-athlete editorial for the Olympic village announcement campaign.",
    thumbnail: "/projects/team-usa.jpg",
    lastEdited: "4 days ago",
    type: "active",
    athleteIds: ["1", "2", "3"],
    workflowId: "wf-victory-podium",
    status: "Complete",
    assetCount: 24,
  },
];

export const archivedProjects: Project[] = [
  {
    id: "archive-1",
    name: "Open Water Series 2025",
    thumbnail: "/projects/archive-1.jpg",
    lastEdited: "2 months ago",
    type: "archived",
    athleteName: "Kristian Gkolomeev",
    status: "Archived",
  },
  {
    id: "archive-2",
    name: "Pan-Am Swimming 2025",
    thumbnail: "/projects/archive-2.jpg",
    lastEdited: "3 months ago",
    type: "archived",
    athleteName: "Felipe Lima",
    status: "Archived",
  },
  {
    id: "archive-3",
    name: "British Track Championships",
    thumbnail: "/projects/archive-3.jpg",
    lastEdited: "4 months ago",
    type: "archived",
    athleteName: "Reece Prescod",
    status: "Archived",
  },
  {
    id: "archive-4",
    name: "Olympic Trials Coverage",
    thumbnail: "/projects/archive-4.jpg",
    lastEdited: "5 months ago",
    type: "archived",
    athleteName: "Isabella Arcila",
    status: "Archived",
  },
  {
    id: "archive-5",
    name: "European Swim Tour",
    thumbnail: "/projects/archive-5.jpg",
    lastEdited: "6 months ago",
    type: "archived",
    athleteName: "Natalia Fryckowska",
    status: "Archived",
  },
  {
    id: "archive-6",
    name: "Pre-Season Training Camp",
    thumbnail: "/projects/archive-6.jpg",
    lastEdited: "7 months ago",
    type: "archived",
    athleteName: "Max Mccusker",
    status: "Archived",
  },
];
