export interface Pose {
  id: string;
  name: string;
  description: string;
  /** Prompt tokens injected into generation */
  promptText: string;
  /** Approximate framing for aspect-ratio guidance */
  framing: "close" | "upper" | "mid" | "full";
}

export const POSES: Pose[] = [
  {
    id: "square-neutral",
    name: "Square Neutral Anchor",
    description: "Body square to camera, head level, shoulders squared",
    promptText: "body square to camera, head level, shoulders squared, neutral stance, direct eye contact",
    framing: "mid",
  },
  {
    id: "three-quarter-authority",
    name: "Three-Quarter Authority",
    description: "Torso rotated 20–35°, head returned to camera",
    promptText: "torso rotated 20-35° from camera, head returned to camera, three-quarter stance, authoritative presence",
    framing: "mid",
  },
  {
    id: "off-axis-editorial",
    name: "Off-Axis Editorial Confidence",
    description: "Body angled, eyes just off-lens",
    promptText: "body angled away from camera, eyes just off-lens, editorial stance, self-possessed gaze",
    framing: "mid",
  },
  {
    id: "sculptural-stillness",
    name: "Sculptural Stillness",
    description: "Symmetrical stance, minimal silhouette noise",
    promptText: "symmetrical stance, minimal silhouette noise, balanced composure, architectural stillness",
    framing: "full",
  },
  {
    id: "close-intensity",
    name: "Close Intensity",
    description: "Head-and-shoulders, slight head rotation",
    promptText: "head-and-shoulders framing, slight head rotation, intense focused gaze, close portrait",
    framing: "close",
  },
  {
    id: "angular-closeup",
    name: "Angular Close-Up",
    description: "Head turned further off-axis, cheek partially in shadow",
    promptText: "head turned further off-axis, cheek partially in shadow, angular close portrait, geometric face planes",
    framing: "close",
  },
  {
    id: "upper-torso-authority",
    name: "Upper-Torso Authority",
    description: "Upper torso visible, chest neutral",
    promptText: "upper torso visible, chest neutral, medium portrait framing, composed upper body",
    framing: "upper",
  },
  {
    id: "mid-torso-sculptural",
    name: "Mid-Torso Sculptural",
    description: "Torso visible to just below the belt line",
    promptText: "torso visible to just below the belt line, three-quarter length portrait, sculptural framing",
    framing: "full",
  },
  {
    id: "deep-shadow-profile",
    name: "Deep Shadow Profile",
    description: "Face rotated, one entire side falls into shadow",
    promptText: "face rotated, one entire side in deep shadow, dramatic profile stance, graphic silhouette",
    framing: "close",
  },
  {
    id: "near-profile-return",
    name: "Near-Profile Return",
    description: "Head close to profile, eyes return toward lens",
    promptText: "head close to profile view, eyes returning toward lens, near-profile tension, contemplative angle",
    framing: "close",
  },
  {
    id: "chin-down-compression",
    name: "Chin-Down Compression",
    description: "Chin slightly lowered, brow shadow emphasized",
    promptText: "chin slightly lowered, brow shadow emphasized, compressed expression, intense brow line",
    framing: "close",
  },
  {
    id: "high-cheek-plane",
    name: "High Cheek Plane",
    description: "Light carving cheekbone sharply",
    promptText: "light carving cheekbone sharply, high cheekbone lit, sculptural face planes, defined bone structure",
    framing: "close",
  },
  {
    id: "long-neck-vertical",
    name: "Long-Neck Vertical",
    description: "Neck elongated, shoulders dropped",
    promptText: "neck elongated, shoulders dropped, vertical elongation, composed upright posture",
    framing: "upper",
  },
  {
    id: "jawline-cut",
    name: "Jawline Cut",
    description: "Light slicing across jaw, mouth partially obscured",
    promptText: "light slicing across jaw, defined jawline, mouth partially obscured by shadow, sculptural lower face",
    framing: "close",
  },
  {
    id: "shoulder-forward",
    name: "Shoulder-Forward Stance",
    description: "One shoulder subtly advanced",
    promptText: "one shoulder subtly advanced, asymmetric stance, relaxed asymmetry, editorial presence",
    framing: "upper",
  },
  {
    id: "static-power-lean",
    name: "Static Power Lean",
    description: "Micro lean from hips, no motion",
    promptText: "micro lean from hips, no motion blur, static power stance, controlled physical presence",
    framing: "full",
  },
  {
    id: "collarbone-frame",
    name: "Collarbone Frame",
    description: "Upper torso with collarbone tension visible",
    promptText: "upper torso, collarbone tension visible, chest and collar in frame, athletic anatomy prominent",
    framing: "upper",
  },
  {
    id: "severe-crop",
    name: "Severe Crop Portrait",
    description: "Tight framing, facial planes dominate",
    promptText: "tight crop framing, facial planes dominate, severe portrait crop, graphic face-fill composition",
    framing: "close",
  },
  {
    id: "shadow-dominant",
    name: "Shadow-Dominant Face",
    description: "Majority of face in shadow, eyes still readable",
    promptText: "majority of face in shadow, eyes still readable in darkness, shadow portrait, minimal highlight reveal",
    framing: "close",
  },
  {
    id: "editorial-three-quarter-full",
    name: "Editorial Three-Quarter Full",
    description: "Torso to just below belt, strong vertical posture",
    promptText: "torso to just below belt, strong vertical posture, editorial full-length stance, composed full figure",
    framing: "full",
  },
];

export function getPoseById(id: string): Pose | undefined {
  return POSES.find(p => p.id === id);
}
