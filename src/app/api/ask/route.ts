import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";
import { callGroq } from "@/lib/groq";
import { buildQuestionContext } from "@/lib/qa-context";

export const runtime = "nodejs";

function isReportQuestion(question: string) {
  return /(amazon|звіт|дан(і|их)|sku|asin|товар|продукт|країн|country|marketplace|sales|продаж|profit|прибут|margin|марж|ppc|ads|реклам|units|шт|refund|bsr|sessions|сес|march|берез|april|квіт|місяц|портфел|roi|acos|перевір|просів|падін|top|топ|найбільш|найкращ)/i.test(
    question
  );
}

export async function POST(request: Request) {
  const { question } = (await request.json().catch(() => ({}))) as { question?: string };
  const normalizedQuestion = question?.trim();

  if (!normalizedQuestion) {
    return NextResponse.json({ message: "Question is required." }, { status: 400 });
  }

  if (!isReportQuestion(normalizedQuestion)) {
    return NextResponse.json({
      answer:
        "Я відповідаю тільки на питання по цьому Amazon-звіту: продажі, прибуток, маржа, країни, SKU, PPC, Units та зміни March vs April 2026.",
      provider: "guard"
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: "GROQ_API_KEY is not set." }, { status: 503 });
  }

  const data = getDashboardData();

  let result: { response: Response; model: string };
  try {
    result = await callGroq(
      {
        temperature: 0.15,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "You are an Amazon marketplace data analyst. Answer in Ukrainian. Use only the provided post-pandas aggregated context. Answer the user's business question directly from the available metrics and helper lists. If the question asks which SKUs to check first, interpret it as risk prioritization and use biggestProfitDrops, biggestMarginDrops, biggestSalesDrops, sales deltas, units deltas and margin deltas as proxy signals. Do not say the data lacks a literal 'check first' field when risk/drop helper lists are present. If the question is about best-selling products, use Sales EUR by default and mention Units when useful. Only say the prepared data is insufficient when the requested field or relationship is truly absent from the context. Be concise, business-oriented, and include exact numbers where relevant."
          },
          {
            role: "user",
            content: JSON.stringify({
              question: normalizedQuestion,
              preparedDataContext: buildQuestionContext(data, normalizedQuestion)
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
  const answer = groqResponse?.choices?.[0]?.message?.content;

  if (typeof answer !== "string" || !answer.trim()) {
    return NextResponse.json({ message: "Groq returned an empty answer." }, { status: 502 });
  }

  return NextResponse.json({
    answer: answer.trim(),
    provider: "groq",
    model: result.model
  });
}
