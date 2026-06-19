// app/api/analytics/nlp/route.ts
// Next.js App Router — POST /api/analytics/nlp
// Pipeline: xWeather API → Tokenizing → Stemming → Processing (NLP murni) → Response

import { NextRequest, NextResponse } from "next/server"
import { tokenizeWeather, type WeatherRaw } from "@/lib/nlp/tokenizing"
import { stemWeather, getAdviceList, getConceptsBySentiment, type StemmedWeather } from "@/lib/nlp/stemming"
import { processNlp, type ProcessedNlp } from "@/lib/nlp/processing"

// ─── Konfigurasi xWeather ────────────────────────────────────────────────────

const XWEATHER_BASE = "https://data.api.xweather.com"
const CLIENT_ID = process.env.XWEATHER_CLIENT_ID ?? process.env.NEXT_PUBLIC_XWEATHER_CLIENT_ID ?? ""
const CLIENT_SECRET = process.env.XWEATHER_CLIENT_SECRET ?? process.env.NEXT_PUBLIC_XWEATHER_CLIENT_SECRET ?? ""

// ─── Tipe request body ───────────────────────────────────────────────────────

interface NlpRequestBody {
  location: string
  action?: string
  /**
   * Opsional: ISO date string hari yang dianalisis (misal "2025-05-27").
   * Dipakai untuk membedakan seed NLG antar hari pada lokasi & kondisi sama.
   */
  dateISO?: string
}

// ─── Tipe response ───────────────────────────────────────────────────────────

interface NlpResponse {
  success: boolean
  location: string
  pipeline: {
    step1_raw: WeatherRaw
    step2_tokens: string[]
    step3_stemmed: {
      concepts: StemmedWeather["concepts"]
      overallSentiment: StemmedWeather["overallSentiment"]
      overallScore: number
    }
    step3b_processing: {
      normalizedTokens: ProcessedNlp["normalizedTokens"]
      removedStopwords: ProcessedNlp["removedStopwords"]
      topNgrams: ProcessedNlp["topNgrams"]
      topTerms: ProcessedNlp["topTerms"]
      keyPhrase: string
    }
    step4_nlp: NlpOutput
  }
  error?: string
}

interface NlpOutput {
  summary: string
  keyPhrase: string
  sentiment: {
    label: StemmedWeather["overallSentiment"]
    score: number
    tone: string
    breakdown: {
      positif: number
      netral: number
      waspada: number
      berbahaya: number
    }
  }
  advice: string[]
  highlights: {
    warnings: string[]
    positives: string[]
  }
  nlpArtifacts: {
    sentences: ProcessedNlp["sentences"]
    bigrams: ProcessedNlp["bigrams"]
    trigrams: ProcessedNlp["trigrams"]
    tfIdfTerms: ProcessedNlp["tfIdfTerms"]
  }
}

// ─── Utiliti: normalisasi nama lokasi dari query string ──────────────────────

/**
 * Konversi "jakarta, id" atau "-6.2,106.8" ke nama yang layak tampil.
 * Dipakai sebagai fallback jika xWeather tidak mengembalikan place.name.
 */
function normalizePlaceName(raw: string): string {
  // Jika koordinat (misal "-6.21,106.84"), kembalikan apa adanya
  if (/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(raw.trim())) return raw.trim()
  // Ambil bagian pertama sebelum koma, title-case
  return raw.split(",")[0].trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Step 1: Fetch xWeather ──────────────────────────────────────────────────

async function fetchWeatherData(location: string, dateISO?: string): Promise<WeatherRaw> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("XWEATHER_CLIENT_ID dan XWEATHER_CLIENT_SECRET belum diset di environment variables.")
  }

  const auth = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
  const fields = [
    "tempC", "tempF", "feelslikeC", "feelslikeF",
    "humidity", "weatherPrimary",
    "windSpeedKPH", "windSpeedMPH", "windDir", "windDirDEG", "windGustKPH",
    "uvi", "visibilityKM", "pop", "precipMM", "sky", "place",
  ].join(",")

  // ── Jika dateISO adalah tanggal masa depan → forecast langsung ──────────
  if (dateISO) {
    const today = new Date().toISOString().split("T")[0]
    if (dateISO > today) {
      try {
        const encodedLoc = encodeURIComponent(location)
        const forecastUrl = `${XWEATHER_BASE}/forecasts/${encodedLoc}?filter=day&limit=7&fields=periods.dateTimeISO,periods.maxTempC,periods.minTempC,periods.tempC,periods.feelslikeC,periods.humidity,periods.weatherPrimary,periods.windSpeedKPH,periods.windSpeedMPH,periods.windDir,periods.windDirDEG,periods.windGustKPH,periods.uvi,periods.visibilityKM,periods.pop,periods.precipMM,periods.sky&${auth}`
        console.log("[NLP API] forecast for date:", forecastUrl.replace(CLIENT_SECRET, "***"))

        const res = await fetch(forecastUrl, { next: { revalidate: 300 } })
        const json = await res.json()

        if (json.success) {
          const periods = json.response?.[0]?.periods
          const place = json.response?.[0]?.place
          if (periods) {
            const targetPeriod = (periods as any[]).find((p: any) => p.dateTimeISO?.startsWith(dateISO))
            if (targetPeriod) {
              const normalized: WeatherRaw = {
                tempC: targetPeriod.maxTempC ?? targetPeriod.minTempC ?? 0,
                tempF: targetPeriod.maxTempF ?? 0,
                feelslikeC: targetPeriod.feelslikeC ?? targetPeriod.maxTempC ?? 0,
                feelslikeF: targetPeriod.feelslikeF ?? 0,
                humidity: targetPeriod.humidity ?? 0,
                weatherPrimary: targetPeriod.weatherPrimary ?? "",
                windSpeedKPH: targetPeriod.windSpeedMaxKPH ?? targetPeriod.windSpeedKPH ?? 0,
                windSpeedMPH: targetPeriod.windSpeedMaxMPH ?? targetPeriod.windSpeedMPH ?? 0,
                windDir: targetPeriod.windDir ?? "N",
                windDirDEG: targetPeriod.windDirDEG ?? 0,
                windGustKPH: targetPeriod.windGustKPH ?? 0,
                uvi: targetPeriod.uvi ?? undefined,
                visibilityKM: targetPeriod.visibilityKM ?? undefined,
                pop: targetPeriod.pop ?? undefined,
                precipMM: targetPeriod.precipMM ?? undefined,
                sky: targetPeriod.sky ?? undefined,
                place,
              }
              return normalized
            }
          }
        }
      } catch (e) {
        console.log("[NLP API] forecast for date error:", e)
      }
      // Jika forecast gagal, fall through ke current conditions
    }
    // Jika dateISO === today, tetap pakai current conditions (lebih akurat)
  }

  // ── Percobaan 1: conditions/summary ──────────────────────────────────────
  try {
    const encodedLoc = encodeURIComponent(location)
    const url = `${XWEATHER_BASE}/conditions/summary/${encodedLoc}?${auth}&fields=${fields}`
    console.log("[NLP API] conditions/summary:", url.replace(CLIENT_SECRET, "***"))

    const res = await fetch(url, { next: { revalidate: 300 } })
    const json = await res.json()

    if (json.success) {
      const ob = json.response?.[0]?.ob
      const place = json.response?.[0]?.place
      if (ob?.tempC !== undefined) return { ...ob, place }

      const period = json.response?.[0]?.periods?.[0]
      if (period?.tempC !== undefined) return { ...period, place }
    }
  } catch (e) {
    console.log("[NLP API] conditions/summary error:", e)
  }

  // ── Percobaan 2: observations/closest ────────────────────────────────────
  try {
    const encodedLoc = encodeURIComponent(location)
    const url = `${XWEATHER_BASE}/observations/closest?p=${encodedLoc}&limit=1&${auth}&fields=${fields}`
    console.log("[NLP API] observations/closest:", url.replace(CLIENT_SECRET, "***"))

    const res = await fetch(url, { next: { revalidate: 300 } })
    const json = await res.json()

    if (json.success) {
      const ob = json.response?.[0]?.ob
      const place = json.response?.[0]?.place
      if (ob?.tempC !== undefined) return { ...ob, place }
    }
  } catch (e) {
    console.log("[NLP API] observations/closest error:", e)
  }

  // ── Percobaan 3: forecasts fallback ──────────────────────────────────────
  try {
    const encodedLoc = encodeURIComponent(location)
    const url = `${XWEATHER_BASE}/forecasts/${encodedLoc}?filter=day&limit=1&fields=periods.dateTimeISO,periods.maxTempC,periods.minTempC,periods.tempC,periods.feelslikeC,periods.humidity,periods.weatherPrimary,periods.windSpeedKPH,periods.windSpeedMPH,periods.windDir,periods.windDirDEG,periods.windGustKPH,periods.uvi,periods.visibilityKM,periods.pop,periods.precipMM,periods.sky&${auth}`
    console.log("[NLP API] forecasts fallback:", url.replace(CLIENT_SECRET, "***"))

    const res = await fetch(url, { next: { revalidate: 300 } })
    const json = await res.json()

    if (json.success) {
      const period = json.response?.[0]?.periods?.[0]
      const place = json.response?.[0]?.place
      if (period) {
        const normalized: WeatherRaw = {
          tempC: period.maxTempC ?? period.minTempC ?? 0,
          tempF: period.maxTempF ?? 0,
          feelslikeC: period.feelslikeC ?? period.maxTempC ?? 0,
          feelslikeF: period.feelslikeF ?? 0,
          humidity: period.humidity ?? 0,
          weatherPrimary: period.weatherPrimary ?? "",
          windSpeedKPH: period.windSpeedMaxKPH ?? period.windSpeedKPH ?? 0,
          windSpeedMPH: period.windSpeedMaxMPH ?? period.windSpeedMPH ?? 0,
          windDir: period.windDir ?? "N",
          windDirDEG: period.windDirDEG ?? 0,
          windGustKPH: period.windGustKPH ?? 0,
          uvi: period.uvi ?? undefined,
          visibilityKM: period.visibilityKM ?? undefined,
          pop: period.pop ?? undefined,
          precipMM: period.precipMM ?? undefined,
          sky: period.sky ?? undefined,
          place,
        }
        return normalized
      }
    }
  } catch (e) {
    console.log("[NLP API] forecasts fallback error:", e)
  }

  throw new Error("Tidak dapat mengambil data cuaca dari semua endpoint xWeather.")
}

// ─── Inject nama lokasi fallback ke raw.place ─────────────────────────────────
/**
 * Jika xWeather tidak mengembalikan place.name (sering terjadi pada koordinat
 * atau kota kecil), inject nama dari request body agar narasi NLG tidak
 * menampilkan "Tidak diketahui".
 */
function ensurePlaceName(raw: WeatherRaw, requestLocation: string): WeatherRaw {
  if (raw.place?.name) return raw   // sudah ada, tidak perlu diubah

  const fallbackName = normalizePlaceName(requestLocation)
  return {
    ...raw,
    place: {
      ...(raw.place ?? {}),
      name: fallbackName,
    },
  }
}

// ─── Step 4b: Sentiment Analysis ─────────────────────────────────────────────

function seedFromString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0
  }
  return Math.abs(h)
}

function pick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length]
}

const TONE_ARRAYS: Record<StemmedWeather["overallSentiment"], string[]> = {
  baik: [
    "Positif — cuaca mendukung aktivitas normal",
    "Langit bersahabat, aktivitas lancar tanpa hambatan berarti",
    "Semua indikator cuaca menunjukkan kondisi yang nyaman dan aman",
    "Cuaca sedang ramah — tidak ada yang perlu dikhawatirkan",
    "Hari yang baik untuk keluar, langit dan angin mendukung penuh",
    "Kondisi optimal, semua parameter cuaca ada di zona hijau",
    "Tenang dan stabil — cuaca sedang berpihak padamu",
    "Tidak ada gangguan cuaca yang berarti, nikmati harimu",
  ],
  cukup: [
    "Netral — kondisi dapat diterima dengan sedikit catatan",
    "Cuaca standar, tidak istimewa tapi tidak mengkhawatirkan",
    "Beberapa parameter sedikit bergeser, tapi masih dalam batas aman",
    "Kondisi cukup lumayan, aktivitas ringan tetap bisa dilakukan",
    "Cuaca biasa saja — ada yang kurang ideal, tapi risikonya kecil",
    "Tidak perlu khawatir berlebihan, tapi tetap perhatikan sekeliling",
    "Kondisi masih dalam batas wajar, dengan beberapa catatan kecil",
    "Hari yang biasa, tidak ada yang ekstrem — tetap waspada wajar",
  ],
  waspada: [
    "Waspada — beberapa parameter cuaca memerlukan perhatian",
    "Ada tanda-tanda yang perlu diamati sebelum beraktivitas di luar",
    "Cuaca tidak sepenuhnya bersahabat, periksa kondisi sebelum keluar",
    "Beberapa indikator menunjukkan potensi risiko ringan hingga sedang",
    "Perlu kewaspadaan ekstra, beberapa parameter cuaca kurang ideal",
    "Tidak berbahaya, tapi ada beberapa hal yang perlu diantisipasi",
    "Cuaca sedikit menantang — tetap siaga dan jangan lengah",
    "Risiko rendah hingga sedang terdeteksi, perhatikan sekeliling",
  ],
  berbahaya: [
    "Negatif — kondisi ekstrem, aktivitas outdoor tidak disarankan",
    "Situasi cuaca cukup serius, tunda aktivitas luar ruangan jika tidak mendesak",
    "Cuaca tidak bersahabat — prioritas utama adalah keselamatan",
    "Risiko tinggi terdeteksi, disarankan tetap di dalam ruangan",
    "Beberapa parameter cuaca mencapai level berbahaya, jangan ambil risiko",
    "Peringatan: kondisi luar ruangan tidak aman untuk aktivitas apa pun",
    "Cuaca ekstrem teridentifikasi — lebih baik aman daripada menyesal",
    "Hari ini alam sedang tidak berpihak, tunda semua rencana outdoor",
  ],
}

function analyzeSentiment(stemmed: StemmedWeather): NlpOutput["sentiment"] {
  const total = stemmed.concepts.length || 1

  const counts = {
    positif: stemmed.concepts.filter(c => c.sentiment === "positif").length,
    netral: stemmed.concepts.filter(c => c.sentiment === "netral").length,
    waspada: stemmed.concepts.filter(c => c.sentiment === "waspada").length,
    berbahaya: stemmed.concepts.filter(c => c.sentiment === "berbahaya").length,
  }

  const seed = seedFromString(stemmed.location + stemmed.overallSentiment + stemmed.overallScore)
  const toneArray = TONE_ARRAYS[stemmed.overallSentiment]

  return {
    label: stemmed.overallSentiment,
    score: stemmed.overallScore,
    tone: pick(toneArray, seed, 0) + ".",
    breakdown: {
      positif: Math.round((counts.positif / total) * 100),
      netral: Math.round((counts.netral / total) * 100),
      waspada: Math.round((counts.waspada / total) * 100),
      berbahaya: Math.round((counts.berbahaya / total) * 100),
    },
  }
}

// ─── Step 4c: Highlights ─────────────────────────────────────────────────────

function buildHighlights(stemmed: StemmedWeather): NlpOutput["highlights"] {
  return {
    warnings: [...getConceptsBySentiment(stemmed, "waspada"), ...getConceptsBySentiment(stemmed, "berbahaya")]
      .map(c => c.humanLabel),
    positives: getConceptsBySentiment(stemmed, "positif").map(c => c.humanLabel),
  }
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<NlpResponse>> {
  try {
    const body: NlpRequestBody = await req.json()

    if (!body.location) {
      return NextResponse.json(
        { success: false, location: "", pipeline: {} as NlpResponse["pipeline"], error: "Parameter 'location' wajib diisi." },
        { status: 400 }
      )
    }

    // ── Step 1: Fetch raw weather ─────────────────────────────────────────
    let raw = await fetchWeatherData(body.location, body.dateISO)

    // ── Inject nama lokasi jika place.name kosong ─────────────────────────
    // Ini mencegah narasi NLG menampilkan "Tidak diketahui"
    raw = ensurePlaceName(raw, body.location)

    // ── Step 2: Tokenizing ────────────────────────────────────────────────
    const tokens = tokenizeWeather(raw)
    const textTokens = tokens.map(t => t.textToken)

    // ── Step 3: Stemming ──────────────────────────────────────────────────
    const stemmed = stemWeather(tokens)

    // ── Step 3b: Pure NLP Processing ─────────────────────────────────────
    // Oper dateISO opsional agar card hari berbeda mendapat narasi berbeda
    // meski lokasi & kondisi cuaca identik
    const processed = processNlp(tokens, stemmed, body.dateISO)

    // ── Step 4: Assemble NLP output ───────────────────────────────────────
    const sentiment = analyzeSentiment(stemmed)
    const advice = getAdviceList(stemmed)
    const highlights = buildHighlights(stemmed)

    const nlpOutput: NlpOutput = {
      summary: processed.narrative,
      keyPhrase: processed.keyPhrase,
      sentiment,
      advice,
      highlights,
      nlpArtifacts: {
        sentences: processed.sentences,
        bigrams: processed.bigrams,
        trigrams: processed.trigrams,
        tfIdfTerms: processed.tfIdfTerms,
      },
    }

    return NextResponse.json({
      success: true,
      location: stemmed.location,
      pipeline: {
        step1_raw: raw,
        step2_tokens: textTokens,
        step3_stemmed: {
          concepts: stemmed.concepts,
          overallSentiment: stemmed.overallSentiment,
          overallScore: stemmed.overallScore,
        },
        step3b_processing: {
          normalizedTokens: processed.normalizedTokens,
          removedStopwords: processed.removedStopwords,
          topNgrams: processed.topNgrams,
          topTerms: processed.topTerms,
          keyPhrase: processed.keyPhrase,
        },
        step4_nlp: nlpOutput,
      },
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan tidak dikenal."
    console.error("[NLP API]", message)
    return NextResponse.json(
      { success: false, location: "", pipeline: {} as NlpResponse["pipeline"], error: message },
      { status: 500 }
    )
  }
}

// ─── GET: health check ───────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    endpoint: "POST /api/analytics/nlp",
    pipeline: ["step1: xWeather fetch", "step2: tokenizing", "step3: stemming", "step3b: NLP processing", "step4: sentiment + NLG"],
    requiredBody: { location: "string (koordinat 'lat,lng' atau nama kota)", dateISO: "string opsional (misal '2025-05-27')" },
    envRequired: ["XWEATHER_CLIENT_ID", "XWEATHER_CLIENT_SECRET"],
  })
}