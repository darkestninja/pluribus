// ── Sport categories ─────────────────────────────────────────────────────────

export type SportCategory =
  | "athletics"   // track & field
  | "swimming"
  | "team"        // football, basketball, rugby
  | "combat"      // boxing, MMA, wrestling
  | "gym"         // weightlifting, cross-training
  | "generic";    // catch-all

// ── Clothing item types ───────────────────────────────────────────────────────

export type ClothingItemType =
  // Tops
  | "jersey" | "singlet" | "tshirt" | "polo" | "hoodie" | "tank" | "sports_bra" | "bikini_top"
  // Bottoms
  | "shorts" | "leggings" | "compression_shorts" | "skirt" | "bikini_bottom" | "jammers"
  // One-piece / full-body
  | "swimsuit_onepiece" | "unitard" | "wrestling_singlet" | "speedsuit"
  // Footwear
  | "running_shoes" | "spikes" | "cleats" | "basketball_shoes" | "pool_sandals"
  // Accessories
  | "swim_cap" | "cap" | "goggles" | "headband" | "gloves" | "compression_socks";

export interface ClothingItemMeta {
  label: string;
  promptLabel: string; // used in generation prompt
  category: "top" | "bottom" | "onepiece" | "footwear" | "accessory";
  sports: SportCategory[];
}

export const CLOTHING_META: Record<ClothingItemType, ClothingItemMeta> = {
  jersey:              { label: "Jersey",           promptLabel: "athletic jersey",           category: "top",       sports: ["team", "athletics", "generic"] },
  singlet:             { label: "Singlet",           promptLabel: "running singlet",           category: "top",       sports: ["athletics", "combat", "generic"] },
  tshirt:              { label: "T-Shirt",           promptLabel: "athletic t-shirt",          category: "top",       sports: ["gym", "generic"] },
  polo:                { label: "Polo",              promptLabel: "sports polo shirt",         category: "top",       sports: ["generic"] },
  hoodie:              { label: "Hoodie",            promptLabel: "athletic hoodie",           category: "top",       sports: ["gym", "generic"] },
  tank:                { label: "Tank Top",          promptLabel: "athletic tank top",         category: "top",       sports: ["gym", "athletics", "generic"] },
  sports_bra:          { label: "Sports Bra",        promptLabel: "sports bra",               category: "top",       sports: ["athletics", "gym", "generic"] },
  bikini_top:          { label: "Bikini Top",        promptLabel: "athletic bikini top",       category: "top",       sports: ["swimming"] },
  shorts:              { label: "Shorts",            promptLabel: "athletic shorts",           category: "bottom",    sports: ["athletics", "team", "gym", "combat", "generic"] },
  leggings:            { label: "Leggings",          promptLabel: "compression leggings",      category: "bottom",    sports: ["gym", "athletics", "generic"] },
  compression_shorts:  { label: "Compression",       promptLabel: "compression shorts",        category: "bottom",    sports: ["athletics", "team", "gym"] },
  skirt:               { label: "Sport Skirt",       promptLabel: "athletic skirt",           category: "bottom",    sports: ["generic"] },
  bikini_bottom:       { label: "Bikini Bottom",     promptLabel: "athletic bikini bottom",    category: "bottom",    sports: ["swimming"] },
  jammers:             { label: "Jammers",           promptLabel: "swim jammers",              category: "bottom",    sports: ["swimming"] },
  swimsuit_onepiece:   { label: "One-Piece Swimsuit",promptLabel: "one-piece competitive swimsuit", category: "onepiece", sports: ["swimming"] },
  unitard:             { label: "Unitard",           promptLabel: "athletic unitard",          category: "onepiece",  sports: ["gym", "generic"] },
  wrestling_singlet:   { label: "Wrestling Singlet", promptLabel: "wrestling singlet",         category: "onepiece",  sports: ["combat"] },
  speedsuit:           { label: "Speed Suit",        promptLabel: "full-body swim speed suit", category: "onepiece",  sports: ["swimming"] },
  running_shoes:       { label: "Running Shoes",     promptLabel: "running shoes",             category: "footwear",  sports: ["athletics", "gym", "generic"] },
  spikes:              { label: "Track Spikes",      promptLabel: "track spikes",              category: "footwear",  sports: ["athletics"] },
  cleats:              { label: "Cleats",            promptLabel: "football cleats",           category: "footwear",  sports: ["team"] },
  basketball_shoes:    { label: "Court Shoes",       promptLabel: "basketball court shoes",    category: "footwear",  sports: ["team"] },
  pool_sandals:        { label: "Pool Sandals",      promptLabel: "pool sandals",              category: "footwear",  sports: ["swimming"] },
  swim_cap:            { label: "Swim Cap",          promptLabel: "swim cap",                  category: "accessory", sports: ["swimming"] },
  cap:                 { label: "Cap",               promptLabel: "athletic cap",              category: "accessory", sports: ["athletics", "team", "gym", "generic"] },
  goggles:             { label: "Goggles",           promptLabel: "swimming goggles",          category: "accessory", sports: ["swimming"] },
  headband:            { label: "Headband",          promptLabel: "athletic headband",         category: "accessory", sports: ["athletics", "gym", "generic"] },
  gloves:              { label: "Gloves",            promptLabel: "boxing gloves",             category: "accessory", sports: ["combat"] },
  compression_socks:   { label: "Compression Socks", promptLabel: "compression socks",         category: "accessory", sports: ["athletics", "team"] },
};

// ── Sport presets — default items shown for each sport ───────────────────────

export const SPORT_PRESETS: Record<SportCategory, ClothingItemType[]> = {
  athletics: ["singlet", "shorts", "running_shoes", "spikes", "cap"],
  swimming:  ["swimsuit_onepiece", "bikini_top", "bikini_bottom", "jammers", "speedsuit", "swim_cap", "goggles"],
  team:      ["jersey", "shorts", "cleats", "compression_shorts", "cap"],
  combat:    ["wrestling_singlet", "shorts", "sports_bra", "gloves"],
  gym:       ["tshirt", "tank", "shorts", "leggings", "sports_bra", "running_shoes", "hoodie"],
  generic:   ["jersey", "tshirt", "singlet", "shorts", "leggings", "running_shoes", "cap"],
};

export const SPORT_LABELS: Record<SportCategory, string> = {
  athletics: "Athletics",
  swimming:  "Swimming",
  team:      "Team Sport",
  combat:    "Combat",
  gym:       "Gym / Weights",
  generic:   "Generic",
};

// ── Color palette ─────────────────────────────────────────────────────────────

export interface PaletteColor {
  id: string;
  hex: string;
  label: string;
}

export const PALETTE: PaletteColor[] = [
  { id: "black",       hex: "#111111", label: "Black" },
  { id: "white",       hex: "#f0f0f0", label: "White" },
  { id: "grey",        hex: "#6b7280", label: "Grey" },
  { id: "charcoal",    hex: "#374151", label: "Charcoal" },
  { id: "red",         hex: "#dc2626", label: "Red" },
  { id: "maroon",      hex: "#7f1d1d", label: "Maroon" },
  { id: "orange",      hex: "#f97316", label: "Orange" },
  { id: "yellow",      hex: "#eab308", label: "Yellow" },
  { id: "gold",        hex: "#d4a017", label: "Gold" },
  { id: "green",       hex: "#16a34a", label: "Green" },
  { id: "lime",        hex: "#65a30d", label: "Lime" },
  { id: "teal",        hex: "#0d9488", label: "Teal" },
  { id: "sky",         hex: "#0ea5e9", label: "Sky Blue" },
  { id: "royal",       hex: "#2563eb", label: "Royal Blue" },
  { id: "navy",        hex: "#1e3a8a", label: "Navy" },
  { id: "purple",      hex: "#7c3aed", label: "Purple" },
  { id: "pink",        hex: "#ec4899", label: "Pink" },
  { id: "silver",      hex: "#94a3b8", label: "Silver" },
];

// ── Kit types ─────────────────────────────────────────────────────────────────

export type WardrobeMode = "builder" | "upload";

export type LogoPlacement = "chest_left" | "chest_center" | "back" | "sleeve_left";

export interface ClothingItem {
  type: ClothingItemType;
  primaryColor: string;        // PaletteColor id
  secondaryColor?: string;     // PaletteColor id — for accent/trim
  fit?: "fitted" | "standard" | "loose";
}

export interface WardrobeLogo {
  imageDataUrl: string;        // base64 compressed
  brand?: string;              // text description e.g. "Nike swoosh"
  placement: LogoPlacement;
}

export interface WardrobeKit {
  id: string;
  name: string;
  mode: WardrobeMode;
  sport: SportCategory;
  createdAt: string;
  updatedAt: string;

  // Builder mode
  items: ClothingItem[];
  logo?: WardrobeLogo;

  // Upload mode — full garment photo(s)
  uploadDataUrls?: string[];   // multiple images (preferred)
  uploadDataUrl?: string;      // legacy single, kept for compat
  uploadDescription?: string;  // AI-analysed
}
