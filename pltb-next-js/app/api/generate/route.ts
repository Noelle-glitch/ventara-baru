import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {

  const cookie = req.headers.get("cookie") || "";

  const formData = await req.formData();

  const res = await fetch(
    "http://127.0.0.1:5000/generate_full",
    {
      method: "POST",
      headers: {
        cookie,
      },
      body: formData,
    }
  );

  const data = await res.json();

  return NextResponse.json(data);
}