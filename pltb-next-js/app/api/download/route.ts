import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "general";

  const cookie = req.headers.get("cookie") || "";  // ← tambah

  const res = await fetch(`http://127.0.0.1:5000/download_full/${mode}`, {
    cache: "no-store",
    headers: { cookie },  // ← tambah
  });

  if (!res.ok) {
    return NextResponse.json({ error: "File belum ada" }, { status: 404 });
  }

  const blob = await res.blob();
  const contentDisposition =
    res.headers.get("content-disposition") ??
    `attachment; filename="forecast_${mode}.csv"`;

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": contentDisposition,
    },
  });
}