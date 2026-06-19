import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");

  // Hardcode sementara untuk test
  const clientId = "JBovq7TP7N6HlJag1yqNn";
  const clientSecret = "tw1JdQhj4koCl9e1RhFmWeMEntNKUxeIpn5Po4Za";

  const url = `https://api.xweather.com/forecasts/${lat},${lng}?client_id=${clientId}&client_secret=${clientSecret}&filter=day&limit=7&units=metric`;

  console.log("=== XWeather Daily called ===");
  console.log("URL:", url);

  try {
    const res = await fetch(url);
    const text = await res.text();

    console.log("Status:", res.status);
    console.log("Response:", text.substring(0, 800));

    if (!res.ok) {
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}