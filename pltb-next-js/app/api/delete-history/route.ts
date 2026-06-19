import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  const res = await fetch(`http://127.0.0.1:5000/delete_history?id=${id}`, {
    method: "DELETE",
    headers: {
      "X-Username": username,
    },
  });
  const data = await res.json();
  return NextResponse.json(data);
}