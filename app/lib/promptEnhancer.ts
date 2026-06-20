export const QUALITY_NEGATIVE = "";

/**
 * Strips common prompt injection patterns from talent-sourced text fields.
 * Removes instruction-override attempts before they reach the generation model.
 */
export function sanitizePromptField(text: string): string {
  return text
    // Strip injection trigger phrases
    .replace(/ignore\s+(previous|prior|all|above)\s+(instructions?|prompts?|rules?|context)/gi, "")
    .replace(/\bnow\s+(you\s+are|act\s+as|pretend|forget)\b/gi, "")
    .replace(/\bsystem\s*prompt\b/gi, "")
    .replace(/\b(nsfw|nude|naked|explicit|sexual|violent|gore|harmful)\b/gi, "")
    .replace(/\[\s*(INST|SYS|SYSTEM|USER|ASSISTANT)\s*\]/gi, "")
    .replace(/<\|?(system|user|assistant|im_start|im_end)\|?>/gi, "")
    // Collapse excessive punctuation that can be used for delimiter injection
    .replace(/[^\w\s,.\-''""/()%:!?]{3,}/g, " ")
    .trim();
}

/**
 * Builds a Nano Banana scene prompt from the active creative direction layers.
 * Identity comes from reference images — not the prompt.
 * Layers: slot scene (pack) → custom notes → subject constraints → wardrobe text → moodboard text.
 * Talent-sourced fields (customNotes, doNotChange) are sanitized before assembly.
 */
export function buildGenerationPrompt({
  slotNotes,
  wardrobeText,
  moodboardText,
  customNotes,
  doNotChange,
}: {
  slotNotes?: string;
  wardrobeText?: string;
  moodboardText?: string;
  customNotes?: string;
  doNotChange?: string[];
}): string {
  const inline: string[] = [];
  if (slotNotes?.trim())    inline.push(slotNotes.trim());
  // Sanitize talent-sourced fields
  if (customNotes?.trim())  inline.push(sanitizePromptField(customNotes.trim()));
  if (doNotChange?.length)  inline.push(sanitizePromptField(doNotChange.join(", ")));

  let prompt = inline.join(", ");
  if (wardrobeText?.trim())  prompt += `\n\n${wardrobeText.trim()}`;
  if (moodboardText?.trim()) prompt += `\n\n${moodboardText.trim()}`;

  return prompt || "Professional sports portrait, dramatic lighting, photorealistic";
}
