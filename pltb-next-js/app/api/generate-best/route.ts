import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {

  const cookie = req.headers.get("cookie") || "";

  const res = await fetch(
    "http://127.0.0.1:5000/generate_best",
    {
      method: "POST",
      headers: {
        cookie,
      },
    }
  );

  const data = await res.json();

  return NextResponse.json(data);
}