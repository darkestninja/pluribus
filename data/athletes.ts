export type AngleKey =
  | "face-front" | "face-left" | "face-right" | "face-back" | "face-close"
  | "body-front" | "body-left" | "body-right" | "body-back";

export interface CaptureAngle {
  key: AngleKey;
  dataUrl: string;       // base64 data URL — never a blob URL
  uploadedAt: string;
  notes?: string;
}

export interface TattooMark {
  id: string;
  description: string;
  location: string;
  visible: boolean;      // whether to reference in generation prompts
}

export interface ApprovedLikeness {
  imageUrl: string;      // fal.ai CDN URL
  context: string;       // e.g. "Front face, daylight, competition gear"
  approvedAt: string;
}

export interface AthleteProfile {
  athleteId: string;
  version: number;
  updatedAt: string;
  captureAngles: CaptureAngle[];
  tattoos: TattooMark[];
  doNotChange: string[];          // e.g. ["never remove chest tattoo"]
  approvedLikeness: ApprovedLikeness[];
  notes: string;
}

export interface Athlete {
  id: string;
  name: string;
  sport: "Swimming" | "Track" | "Weightlifting";
  event: string;
  status: "complete" | "pending" | "review";
  image: string;
  captureDate: string | null;
  height?: string;
  weight?: string;
  build?: string;
  skinTone?: string;
  hair?: string;
  age?: number;
  country?: string;
  personalBest?: string;
}

export const athletes: Athlete[] = [
  {
    id: "1",
    name: "James Magnussen",
    sport: "Swimming",
    event: "100m Freestyle",
    status: "complete",
    image: "/athletes/james-magnussen.jpg",
    captureDate: "2026-03-15",
    height: "6'5\" (196cm)",
    weight: "200 lbs (91kg)",
    build: "Power swimmer",
    skinTone: "Fair",
    hair: "Short brown",
    age: 34,
    country: "Australia",
    personalBest: "47.10s",
  },
  {
    id: "2",
    name: "Marvin Bracy-Williams",
    sport: "Track",
    event: "100m Sprint",
    status: "complete",
    image: "/athletes/marvin-bracy.jpg",
    captureDate: "2026-03-14",
    height: "5'9\" (175cm)",
    weight: "165 lbs (75kg)",
    build: "Sprinter build",
    skinTone: "Dark brown",
    hair: "Short fade",
    age: 32,
    country: "USA",
    personalBest: "9.85s",
  },
  {
    id: "3",
    name: "Megan Romano",
    sport: "Swimming",
    event: "200m Freestyle",
    status: "review",
    image: "/athletes/megan-romano.jpg",
    captureDate: "2026-03-10",
    height: "5'9\" (175cm)",
    weight: "150 lbs (68kg)",
    build: "Distance swimmer",
    skinTone: "Fair",
    hair: "Long brown",
    age: 35,
    country: "USA",
    personalBest: "1:55.20",
  },
  {
    id: "4",
    name: "Juan Solis",
    sport: "Weightlifting",
    event: "Clean & Jerk 89kg",
    status: "complete",
    image: "/athletes/juan-solis.jpg",
    captureDate: "2026-04-01",
    height: "5'8\" (173cm)",
    weight: "196 lbs (89kg)",
    build: "Heavy weightlifter",
    skinTone: "Olive",
    hair: "Short black",
    age: 27,
    country: "Mexico",
    personalBest: "405 lbs (184kg)",
  },
  {
    id: "5",
    name: "Tristan Evelyn",
    sport: "Track",
    event: "100m Sprint",
    status: "pending",
    image: "/athletes/tristan-evelyn.jpg",
    captureDate: null,
    height: "5'6\" (168cm)",
    weight: "130 lbs (59kg)",
    build: "Sprinter build",
    skinTone: "Dark brown",
    hair: "Long braids",
    age: 27,
    country: "Barbados",
    personalBest: "11.04s",
  },
];
