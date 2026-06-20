export interface MoodboardSource {
  id: string;
  thumbnail: string;  // base64 dataUrl (resized to ≤512px for storage + analysis)
  filename?: string;
  sourceUrl?: string; // original URL if web-imported
}

export interface CreativeDirection {
  mood: string;
  colorPalette: string;
  lighting: string;
  composition: string;
  style: string;
  environment: string;
  summary: string;
}

export interface Moodboard {
  id: string;
  name: string;
  sources: MoodboardSource[];
  direction: CreativeDirection | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
