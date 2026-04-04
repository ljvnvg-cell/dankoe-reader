import * as deepl from "deepl-node";

const apiKey = process.env.DEEPL_API_KEY;

function getTranslator(): deepl.Translator {
  if (!apiKey) throw new Error("DEEPL_API_KEY not set");
  return new deepl.Translator(apiKey);
}

/**
 * Translate plain text from English to Chinese using DeepL
 */
export async function translateText(text: string): Promise<string> {
  if (!text?.trim()) return "";

  const translator = getTranslator();
  const result = await translator.translateText(text, "en", "zh");
  return result.text;
}

/**
 * Translate HTML content from English to Chinese using DeepL.
 * DeepL natively handles HTML with tag_handling: 'html',
 * preserving tag structure without mangling attributes.
 */
export async function translateHTML(html: string): Promise<string> {
  if (!html?.trim()) return "";

  const translator = getTranslator();
  const result = await translator.translateText(html, "en", "zh", {
    tagHandling: "html",
  });
  return result.text;
}
