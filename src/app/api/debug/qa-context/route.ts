import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";
import { buildQaContext, buildQuestionContext } from "@/lib/qa-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const data = getDashboardData();
  const url = new URL(request.url);
  const question = url.searchParams.get("question");

  if (question?.trim()) {
    return NextResponse.json(buildQuestionContext(data, question));
  }

  return NextResponse.json(buildQaContext(data));
}
