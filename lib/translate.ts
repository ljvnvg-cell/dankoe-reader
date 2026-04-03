import translate from "google-translate-api-x";

/**
 * Translate text from English to Chinese using Google Translate
 */
export async function translateText(text: string): Promise<string> {
  if (!text?.trim()) return "";

  const result = await translate(text, { from: "en", to: "zh-CN" });
  return result.text;
}

/**
 * Translate HTML content paragraph by paragraph, preserving structure.
 * Splits on block-level tags to maintain alignment for bilingual display.
 */
export async function translateHTML(html: string): Promise<string> {
  if (!html?.trim()) return "";

  // Split into paragraphs/blocks while keeping tags
  const blockPattern =
    /(<(?:p|h[1-6]|li|blockquote|div)[^>]*>)([\s\S]*?)(<\/(?:p|h[1-6]|li|blockquote|div)>)/gi;
  const blocks: { full: string; tag: string; content: string; close: string }[] = [];

  let match;
  while ((match = blockPattern.exec(html)) !== null) {
    blocks.push({
      full: match[0],
      tag: match[1],
      content: match[2],
      close: match[3],
    });
  }

  if (blocks.length === 0) {
    // No block tags found, translate as a whole
    const result = await translate(html, { from: "en", to: "zh-CN" });
    return result.text;
  }

  // Translate blocks one by one (with small delay to avoid rate limiting)
  let result = html;
  for (const block of blocks) {
    const text = block.content.trim();
    if (text.length === 0) continue;

    try {
      const translated = await translate(text, { from: "en", to: "zh-CN" });
      result = result.replace(
        block.full,
        `${block.tag}${translated.text}${block.close}`
      );
      // Small delay to be respectful to the API
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.warn(`Translation failed for block: ${err}`);
      // Keep original text on failure
    }
  }

  return result;
}
