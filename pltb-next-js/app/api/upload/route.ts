import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const formData = await req.formData();
  const res = await fetch("http://127.0.0.1:5000/upload_dataset", {
    method: "POST",
    body: formData,
    headers: {
      cookie,  // ← tambah ini
    },
  });
  console.log("Status:", res.status);
  console.log("Content-Type:", res.headers.get("content-type"));
  const text = await res.text();
  console.log("Raw response:", text);
  if (!text) {
    return NextResponse.json({ status: "error", message: "Empty response from Flask" }, { status: 500 });
  }
  const data = JSON.parse(text);
  return NextResponse.json(data);
}