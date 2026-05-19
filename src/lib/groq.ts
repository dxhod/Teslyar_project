export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
export const DEFAULT_FALLBACK_GROQ_MODEL = "openai/gpt-oss-120b";

export function getGroqModels() {
  const primary = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const fallback = process.env.GROQ_FALLBACK_MODEL || DEFAULT_FALLBACK_GROQ_MODEL;
  return [...new Set([primary, fallback])];
}

export async function callGroq(payload: Record<string, unknown>, apiKey: string) {
  const errors: string[] = [];

  for (const model of getGroqModels()) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...payload,
          model
        }),
        next: { revalidate: 0 }
      });

      if (response.ok) {
        return { response, model };
      }

      const errorText = await response.text();
      errors.push(`${model}: ${response.status} ${errorText.slice(0, 240)}`);
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  throw new Error(errors.join(" | "));
}
