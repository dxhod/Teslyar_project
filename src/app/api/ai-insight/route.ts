import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";
import { callGroq } from "@/lib/groq";
import type { AiInsight, AttentionItem, DashboardData } from "@/lib/types";

export const runtime = "nodejs";

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function compactContext(data: DashboardData) {
  const countryDrops = [...data.countries]
    .sort((a, b) => a.netProfitDelta - b.netProfitDelta)
    .slice(0, 5)
    .map((country) => ({
      country: country.country,
      salesMarch: round(country.salesMarch),
      salesApril: round(country.salesApril),
      salesDelta: round(country.salesDelta),
      netProfitMarch: round(country.netProfitMarch),
      netProfitApril: round(country.netProfitApril),
      netProfitDelta: round(country.netProfitDelta),
      marginMarch: round(country.marginMarch),
      marginApril: round(country.marginApril),
      marginDelta: round(country.marginDelta),
      unitsDelta: round(country.unitsDelta),
      ppcSpendDelta: round(country.adSpendDelta)
    }));

  const productRiskCandidates = [...data.products]
    .filter((product) => product.salesApril > 250 || product.salesMarch > 250)
    .map((product) => {
      const riskScore =
        Math.max(0, -product.netProfitDelta) * 1.6 +
        Math.max(0, -product.marginDelta) * 18 +
        Math.max(0, -product.unitsDelta) * 8 +
        (product.salesDelta > 100 && product.netProfitDelta < 0 ? product.salesDelta * 0.35 : 0);

      return {
        sku: product.sku,
        asin: product.asin,
        product: product.product.slice(0, 140),
        salesMarch: round(product.salesMarch),
        salesApril: round(product.salesApril),
        salesDelta: round(product.salesDelta),
        netProfitMarch: round(product.netProfitMarch),
        netProfitApril: round(product.netProfitApril),
        netProfitDelta: round(product.netProfitDelta),
        marginMarch: round(product.marginMarch),
        marginApril: round(product.marginApril),
        marginDelta: round(product.marginDelta),
        unitsMarch: round(product.unitsMarch),
        unitsApril: round(product.unitsApril),
        unitsDelta: round(product.unitsDelta),
        riskScore: round(riskScore)
      };
    })
    .filter((product) => product.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 20);

  return {
    period: "April 2026 vs March 2026",
    portfolio: data.portfolio,
    countryDrops,
    productRiskCandidates
  };
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

function normalizeAttention(candidate: unknown) {
  if (!Array.isArray(candidate) || !candidate.length) {
    throw new Error("Groq response does not include attention items.");
  }

  return candidate
    .filter((item): item is Partial<AttentionItem> => Boolean(item && typeof item === "object"))
    .map((item) => {
      const severity: AttentionItem["severity"] =
        item.severity === "medium" || item.severity === "low" ? item.severity : "high";

      return {
        title: String(item.title || "SKU"),
        subtitle: String(item.subtitle || ""),
        reason: String(item.reason || "Needs review based on month-over-month changes."),
        severity,
        impact: Number.isFinite(Number(item.impact)) ? Number(item.impact) : 0
      };
    })
    .slice(0, 5);
}

function normalizeInsight(candidate: unknown): AiInsight {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Groq response is not a JSON object.");
  }

  const value = candidate as Partial<AiInsight>;

  return {
    headline: typeof value.headline === "string" && value.headline.trim() ? value.headline : "AI summary is unavailable.",
    bullets: Array.isArray(value.bullets) && value.bullets.length ? value.bullets.map(String).slice(0, 5) : [],
    attention: normalizeAttention(value.attention),
    actions:
      Array.isArray(value.actions) && value.actions.length
        ? value.actions.map(String).slice(0, 4)
        : [],
    evidence:
      Array.isArray(value.evidence) && value.evidence.length
        ? value.evidence.map(String).slice(0, 3)
        : ["Groq summary is generated from pandas aggregates."]
  };
}

export async function GET() {
  const data = getDashboardData();
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ message: "GROQ_API_KEY is not set" }, { status: 503 });
  }

  const context = compactContext(data);

  let result: { response: Response; model: string };

  try {
    result = await callGroq(
      {
        temperature: 0.2,
        max_tokens: 1400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an Amazon marketplace business analyst. Answer in English. Use only the supplied numbers. Do not invent metrics. Return valid JSON only."
          },
          {
            role: "user",
            content: JSON.stringify({
              task:
                "Create an executive interpretation for sales managers. Return schema: { headline: string, bullets: string[4], attention: [{ title, subtitle, reason, severity, impact }], actions: string[3-4], evidence: string[] }. The attention array must be chosen by you from productRiskCandidates. Pick 3-5 SKUs that deserve attention first. Prefer material profit impact, sharp margin deterioration, unit decline, or sales growth with profit decline. For each attention item, title must be SKU, subtitle must include ASIN and short product name, reason must be English and cite exact supplied numbers, severity must be high|medium|low, impact should be a numeric priority. Keep actions practical and tied to supplied data.",
              data: context
            })
          }
        ]
      },
      apiKey
    );
  } catch (error) {
    return NextResponse.json(
      { message: `Groq request failed before response: ${error instanceof Error ? error.message : "unknown error"}` },
      { status: 502 }
    );
  }

  const groqResponse = await result.response.json();
  const content = groqResponse?.choices?.[0]?.message?.content;
  const parsed = typeof content === "string" ? tryParseJson(content) : null;

  try {
    return NextResponse.json({
      insight: normalizeInsight(parsed),
      provider: "groq",
      model: result.model
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Invalid Groq response" },
      { status: 502 }
    );
  }
}
