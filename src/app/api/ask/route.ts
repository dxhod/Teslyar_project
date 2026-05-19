import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";
import { callGroq } from "@/lib/groq";
import { buildQuestionContext } from "@/lib/qa-context";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { question } = (await request.json().catch(() => ({}))) as { question?: string };
  const normalizedQuestion = question?.trim();

  if (!normalizedQuestion) {
    return NextResponse.json({ message: "Question is required." }, { status: 400 });
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
              "You are an Amazon marketplace data analyst. Answer in Ukrainian. Use only the provided compact post-pandas aggregated data context. It includes portfolio, all countries, all products with essential metrics, and helper top/drop lists. If the answer is not supported by the prepared data, say that the prepared data does not contain enough information. Be concise, business-oriented, and include exact numbers where relevant. For questions about best-selling products, use Sales EUR by default and mention Units when useful."
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
