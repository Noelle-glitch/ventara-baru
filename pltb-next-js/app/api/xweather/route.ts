import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const location = req.nextUrl.searchParams.get("location") || "";
  const clientId = process.env.NEXT_PUBLIC_XWEATHER_CLIENT_ID || "";
  const clientSecret = process.env.NEXT_PUBLIC_XWEATHER_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    return NextResponse.json({ phrase: "" });
  }

  const baseName = location.split(",")[0].trim();
  const variants = [`${baseName},ID`, baseName, location];

  for (const loc of variants) {
    const url = `https://phrases.api.xweather.com/conditions/${encodeURIComponent(loc)}?stream=false&units=metric&language=id&client_id=${clientId}&client_secret=${clientSecret}`;

    try {
      const res = await fetch(url);
      const text = await res.text();

      if (res.ok && text) {
        const data = JSON.parse(text);
        const phrase =
          data?.response?.phrases?.summary ||
          data?.response?.phrases?.long ||
          data?.response?.phrases?.short ||
          (Array.isArray(data?.response) ? data.response.join(" ") : "") ||
          (typeof data?.response === "string" ? data.response : "") ||
          data?.phrase || data?.text || "";

        if (phrase) return NextResponse.json({ phrase });
      }
    } catch (err) {
      console.log("XWeather proxy error:", loc, err);
    }
  }

  return NextResponse.json({ phrase: "" });
}