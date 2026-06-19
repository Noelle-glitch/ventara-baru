// lib/nlp/processing.ts
// Pure NLP Processing — Step 3 dalam pipeline cuaca
// Input : WeatherToken[] + StemmedWeather dari tokenizing & stemming
// Output: ProcessedNlp yang siap dikonsumsi route.ts
//
// Pipeline internal:
//   1. Text Normalization  — dedupe, stopword removal, canonical form
//   2. N-gram Extraction   — bigram & trigram domain-aware
//   3. TF-IDF Weighting    — bobot term penting dari corpus token
//   4. NLG                 — Natural Language Generation narasi cuaca Bahasa Indonesia
//                            dengan variasi gaya bicara per kondisi & mood

import type { WeatherToken } from "./tokenizing"
import type { StemmedWeather, StemmedConcept } from "./stemming"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe output
// ─────────────────────────────────────────────────────────────────────────────

export interface Ngram {
  tokens: string[]
  gram: 2 | 3
  score: number
  label: string
}

export interface TfIdfTerm {
  term: string
  tf: number
  idf: number
  tfidf: number
}

export interface NlgSentence {
  type: "opening" | "condition" | "wind" | "rain" | "uv" | "advice" | "closing"
  text: string
  weight: number
}

export interface ProcessedNlp {
  normalizedTokens: string[]
  removedStopwords: string[]
  bigrams: Ngram[]
  trigrams: Ngram[]
  topNgrams: Ngram[]
  tfIdfTerms: TfIdfTerm[]
  topTerms: TfIdfTerm[]
  sentences: NlgSentence[]
  narrative: string
  keyPhrase: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Peta weatherPrimary (slug) → label Bahasa Indonesia
// ─────────────────────────────────────────────────────────────────────────────

const WX_LABEL_ID: Record<string, string> = {
  sunny: "Cerah",
  mostly_sunny: "Cerah Berawan",
  partly_cloudy: "Berawan Sebagian",
  mostly_cloudy: "Banyak Awan",
  cloudy: "Mendung",
  overcast: "Langit Tertutup Awan",
  fog: "Berkabut",
  haze: "Berkabut Tipis",
  clear: "Cerah",
  rain: "Hujan",
  showers: "Hujan Singkat",
  light_rain: "Hujan Ringan",
  heavy_rain: "Hujan Lebat",
  drizzle: "Gerimis",
  thunderstorm: "Badai Petir",
  snow: "Bersalju",
  sleet: "Hujan Es",
  freezing_rain: "Hujan Beku",
  blizzard: "Badai Salju",
  windy: "Berangin",
  dust: "Berdebu",
  smoke: "Berasap",
  tornado: "Tornado",
  tropical_storm: "Badai Tropis",
  hurricane: "Badai Angin",
  // fallback untuk slug multi-kata
  "light_rain_showers": "Gerimis Singkat",
  "chance_of_showers": "Kemungkinan Hujan",
  "chance_of_rain": "Kemungkinan Hujan",
  "chance_of_thunderstorm": "Kemungkinan Badai",
  "isolated_thunderstorms": "Badai Petir Tersebar",
  "scattered_thunderstorms": "Badai Petir Menyebar",
  "scattered_showers": "Hujan Tersebar",
  "isolated_showers": "Hujan Singkat",
}

/**
 * Terjemahkan slug weatherPrimary ke label Bahasa Indonesia.
 * Fallback: title-case slug dengan underscore → spasi.
 */
function wxLabelId(slug: string): string {
  // Buang prefix "kondisi_" jika ada
  const clean = slug.startsWith("kondisi_") ? slug.slice(8) : slug
  if (WX_LABEL_ID[clean]) return WX_LABEL_ID[clean]
  // Fallback: ubah underscore jadi spasi, title-case
  return clean.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

// ─────────────────────────────────────────────────────────────────────────────
// Normaliser nama lokasi — buang koordinat, kembalikan nama manusiawi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Jika lokasi adalah koordinat (misal "-6.59,106.79"), kembalikan string kosong
 * sehingga NLG bisa mengganti dengan label generik.
 * Jika nama kota, kembalikan dalam title-case.
 */
function humanLocation(raw: string): string {
  const trimmed = raw.trim()
  // Deteksi koordinat: angka, titik, koma, spasi, minus
  if (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(trimmed)) return ""
  // Bersihkan underscore (dari slug) dan title-case
  return trimmed
    .replace(/_/g, ", ")
    .split(", ")
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(", ")
}

// ─────────────────────────────────────────────────────────────────────────────
// Utiliti — pilih variasi secara deterministik berdasarkan seed
// ─────────────────────────────────────────────────────────────────────────────

function seedFrom(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0
  }
  return Math.abs(h)
}

function seedFromTokens(location: string, tokens: WeatherToken[]): number {
  const getNum = (key: string): number => {
    const t = tokens.find(tk => tk.key === key)
    return t ? Math.round(Number(t.rawValue) * 10) : 0
  }
  const getStr = (key: string): string => {
    const t = tokens.find(tk => tk.key === key)
    return t ? String(t.rawValue) : ""
  }

  const fingerprint = [
    location,
    getStr("weather_primary"),
    getNum("temp_c"),
    getNum("humidity_pct"),
    getNum("pop_pct"),
    getNum("uvi"),
    getNum("precip_mm"),
    getNum("wind_speed_kph"),
    getNum("visibility_km"),
  ].join("|")

  return seedFrom(fingerprint)
}

function pick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length]
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 · Text Normalization
// ─────────────────────────────────────────────────────────────────────────────

const WEATHER_STOPWORDS = new Set([
  "lokasi", "kondisi", "cuaca", "tidak", "ada",
  "dari", "dan", "atau", "yang", "di", "ke",
  "suhu", "angin", "udara",
  "nol", "pct",
])

const NUMERIC_RE = /^(suhu_|feels_like_|humidity_|wind_\d|wind_gust_|sky_|uvi_\d|visibilitas_|peluang_hujan_\d|curah_hujan_\d|lokasi_)/

function normalizeTokens(rawTokens: string[]): {
  normalized: string[]
  removedStopwords: string[]
} {
  const seen = new Set<string>()
  const normalized: string[] = []
  const removedStopwords: string[] = []

  for (const tok of rawTokens) {
    if (seen.has(tok)) continue
    seen.add(tok)

    const baseTerm = tok.replace(/_\d[\d.]*[a-z%]*/g, "").replace(/_+$/, "")

    if (WEATHER_STOPWORDS.has(baseTerm) || WEATHER_STOPWORDS.has(tok)) {
      removedStopwords.push(tok)
      continue
    }

    normalized.push(tok)
  }

  return { normalized, removedStopwords }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 · N-gram Extraction
// ─────────────────────────────────────────────────────────────────────────────

const NGRAM_DOMAIN_BOOST: Record<string, number> = {
  "panas|sangat_lembap": 1.8,
  "sangat_panas|sangat_lembap": 2.2,
  "angin_kencang|kondisi_thunderstorm": 2.0,
  "badai|kondisi_thunderstorm": 2.5,
  "uv_tinggi|kondisi_sunny": 1.5,
  "uv_sangat_tinggi|kondisi_sunny": 1.8,
  "uv_ekstrem|kondisi_sunny": 2.0,
  "jarak_pandang_buruk|kondisi_fog": 1.9,
  "kondisi_heavy_rain|angin_kencang": 2.1,
  "hampir_pasti_hujan|angin_kencang": 1.9,
}

function buildNgramKey(a: string, b: string): string {
  return `${a}|${b}`
}

function buildNgrams(tokens: string[], n: 2 | 3): Ngram[] {
  const ngrams: Ngram[] = []

  for (let i = 0; i <= tokens.length - n; i++) {
    const slice = tokens.slice(i, i + n)
    const hasLabel = slice.some(t => !NUMERIC_RE.test(t))
    if (!hasLabel) continue

    const baseScore = slice.reduce((s, t) => s + t.length, 0) / (n * 10)

    let domainBoost = 1.0
    if (n === 2) {
      const key1 = buildNgramKey(slice[0], slice[1])
      const key2 = buildNgramKey(slice[1], slice[0])
      domainBoost = NGRAM_DOMAIN_BOOST[key1] ?? NGRAM_DOMAIN_BOOST[key2] ?? 1.0
    } else if (n === 3) {
      const pairs = [
        buildNgramKey(slice[0], slice[1]),
        buildNgramKey(slice[1], slice[2]),
        buildNgramKey(slice[0], slice[2]),
      ]
      domainBoost = Math.max(...pairs.map(k => NGRAM_DOMAIN_BOOST[k] ?? 1.0))
    }

    const score = parseFloat((baseScore * domainBoost).toFixed(4))
    const label = slice.join(" + ")
    ngrams.push({ tokens: slice, gram: n, score, label })
  }

  const seen = new Set<string>()
  return ngrams.filter(ng => {
    if (seen.has(ng.label)) return false
    seen.add(ng.label)
    return true
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 · TF-IDF
// ─────────────────────────────────────────────────────────────────────────────

const CORPUS_IDF: Record<string, number> = {
  hangat: 0.4,
  sejuk: 0.4,
  normal: 0.3,
  tenang: 0.4,
  sepoi_sepoi: 0.5,
  tidak_hujan: 0.4,
  curah_hujan_nol: 0.3,
  jarak_pandang_baik: 0.4,
  uv_rendah: 0.5,
  uv_sedang: 0.6,
  lembap: 0.7,
  kering: 0.7,
  angin_ringan: 0.7,
  angin_sedang: 0.8,
  panas: 0.8,
  dingin: 0.8,
  jarak_pandang_sedang: 0.8,
  peluang_hujan_kecil: 0.7,
  peluang_hujan_sedang: 0.8,
  sangat_panas: 1.4,
  sangat_dingin: 1.4,
  sangat_lembap: 1.2,
  sangat_kering: 1.2,
  angin_kencang: 1.3,
  badai: 1.8,
  uv_tinggi: 1.2,
  uv_sangat_tinggi: 1.5,
  uv_ekstrem: 1.9,
  jarak_pandang_buruk: 1.4,
  kemungkinan_hujan: 1.1,
  hampir_pasti_hujan: 1.4,
  "kondisi_thunderstorm": 1.8,
  "kondisi_heavy_rain": 1.5,
  "kondisi_snow": 1.6,
  "kondisi_fog": 1.2,
}

const DEFAULT_IDF = 1.0

function computeTfIdf(
  normalizedTokens: string[],
  concepts: StemmedConcept[]
): TfIdfTerm[] {
  const termFreq = new Map<string, number>()

  for (const tok of normalizedTokens) {
    termFreq.set(tok, (termFreq.get(tok) ?? 0) + 1)
  }
  for (const c of concepts) {
    termFreq.set(c.concept, (termFreq.get(c.concept) ?? 0) + 1)
  }

  const totalTerms = normalizedTokens.length || 1
  const results: TfIdfTerm[] = []

  termFreq.forEach((freq, term) => {
    const tf = freq / totalTerms
    const idf = CORPUS_IDF[term] ?? DEFAULT_IDF
    const tfidf = parseFloat((tf * idf).toFixed(6))
    results.push({ term, tf: parseFloat(tf.toFixed(4)), idf, tfidf })
  })

  return results.sort((a, b) => b.tfidf - a.tfidf)
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 · Natural Language Generation (NLG)
// ─────────────────────────────────────────────────────────────────────────────

type TemplateArgs = {
  location: string        // nama manusiawi (bukan koordinat)
  hasLocation: boolean    // false jika lokasi adalah koordinat
  tempC?: number
  humidity?: number
  windSpeed?: number
  windDir?: string
  windGust?: number
  uvi?: number
  visKm?: number
  pop?: number
  precipMm?: number
  wxLabel?: string        // label Bahasa Indonesia dari weatherPrimary
  seed: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Kalimat pembuka lokasi: "Di [kota]" atau "Hari ini" jika koordinat */
function lokasi(a: TemplateArgs): string {
  return a.hasLocation ? a.location : "Hari ini"
}

/** Label kondisi cuaca dalam huruf kecil */
function wx(a: TemplateArgs): string {
  return (a.wxLabel ?? "berawan").toLowerCase()
}

/** Huruf pertama kapital */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Opening ──────────────────────────────────────────────────────────────────

const OPENING_BAIK: Array<(a: TemplateArgs) => string> = [
  (a) => `${lokasi(a)} ${wx(a)} dengan suhu ${a.tempC?.toFixed(0)}°C, kondisi ideal untuk aktivitas di luar.`,
  (a) => `${cap(wx(a))} menemani ${a.hasLocation ? a.location : "hari ini"}, suhu ${a.tempC?.toFixed(0)}°C terasa nyaman.`,
  (a) => `Cuaca ${a.hasLocation ? a.location : "hari ini"} bersahabat di ${a.tempC?.toFixed(0)}°C. Langit mendukung penuh aktivitasmu.`,
  (a) => `${a.hasLocation ? a.location : "Cuaca hari ini"} menikmati ${wx(a)} di ${a.tempC?.toFixed(0)}°C. Hari yang bagus untuk keluar.`,
  (a) => `Suhu ${a.tempC?.toFixed(0)}°C, langit ${wx(a)} — perpaduan yang pas untuk memulai hari ${a.hasLocation ? `di ${a.location}` : "dengan baik"}.`,
  (a) => `${a.tempC?.toFixed(0)}°C dan kondisi ${wx(a)} saling melengkapi. ${a.hasLocation ? a.location : "Cuaca hari ini"} sedang berada di versi terbaiknya.`,
  (a) => `Nggak perlu khawatir soal cuaca ${a.hasLocation ? `${a.location} hari ini` : "hari ini"}. ${cap(wx(a))}, suhu ${a.tempC?.toFixed(0)}°C, semuanya terkendali.`,
  (a) => `Hari yang cerah ${a.hasLocation ? `menanti di ${a.location}` : ""}, ${a.tempC?.toFixed(0)}°C dengan ${wx(a)}. Langit seolah setuju dengan rencana-rencanamu.`,
  (a) => `${a.tempC?.toFixed(0)}°C, ${wx(a)}, dan angin yang bersahabat — kombinasi yang sulit dikalahkan.`,
  (a) => `${cap(wx(a))} ${a.hasLocation ? `di ${a.location}` : ""} bikin hari ini terasa ringan. Suhu ${a.tempC?.toFixed(0)}°C, udara pas, nggak ada yang perlu dikeluhkan.`,
]

const OPENING_WASPADA: Array<(a: TemplateArgs) => string> = [
  (a) => `${lokasi(a)} ${wx(a)} di ${a.tempC?.toFixed(0)}°C. Perhatikan perkembangan cuaca sebelum keluar.`,
  (a) => `${cap(wx(a))} ${a.hasLocation ? `di ${a.location}` : "hari ini"}, suhu ${a.tempC?.toFixed(0)}°C. Ada beberapa hal yang perlu dicermati.`,
  (a) => `Cuaca ${a.hasLocation ? a.location : "hari ini"} di ${a.tempC?.toFixed(0)}°C perlu sedikit perhatian ekstra.`,
  (a) => `${a.tempC?.toFixed(0)}°C, ${wx(a)} ${a.hasLocation ? `di ${a.location}` : "hari ini"}. Tidak berbahaya, tapi jangan lengah.`,
  (a) => `${a.tempC?.toFixed(0)}°C dengan ${wx(a)} ${a.hasLocation ? `di ${a.location}` : ""}. Kelihatannya biasa aja, tapi ada beberapa parameter yang perlu diwaspadai.`,
  (a) => `Secara umum ${a.hasLocation ? a.location : "cuaca"} masih oke di ${a.tempC?.toFixed(0)}°C, cuma ada beberapa kondisi yang kurang ideal. Cek detailnya sebelum keluar.`,
  (a) => `${a.hasLocation ? a.location : "Hari ini"} sedang tidak sepenuhnya bersahabat. Suhu ${a.tempC?.toFixed(0)}°C, ${wx(a)}, dan beberapa indikator perlu diantisipasi.`,
  (a) => `Ada sedikit gangguan cuaca ${a.hasLocation ? `di ${a.location}` : "hari ini"}. Suhu ${a.tempC?.toFixed(0)}°C, ${wx(a)} — bukan masalah besar, tapi tetap siap-siaga.`,
  (a) => `${a.tempC?.toFixed(0)}°C, langit ${wx(a)}. Kondisi masih bisa ditoleransi, tapi beberapa parameter menunjukkan potensi risiko ringan.`,
  (a) => `Cuaca ${a.hasLocation ? a.location : "hari ini"} ${wx(a)} di ${a.tempC?.toFixed(0)}°C. Lumayan, tapi ada beberapa catatan yang perlu diperhatikan.`,
]

const OPENING_BERBAHAYA: Array<(a: TemplateArgs) => string> = [
  (a) => `⚠ ${a.hasLocation ? a.location : "Cuaca"} sedang tidak bersahabat. ${cap(wx(a))} di ${a.tempC?.toFixed(0)}°C. Tunda aktivitas luar ruangan.`,
  (a) => `${a.hasLocation ? a.location : "Kondisi cuaca"} berbahaya di ${a.tempC?.toFixed(0)}°C. Tetap di dalam jika tidak mendesak.`,
  (a) => `⚠ Waspada penuh ${a.hasLocation ? `di ${a.location}` : "hari ini"}. ${cap(wx(a))}, ${a.tempC?.toFixed(0)}°C, risiko nyata di luar.`,
  (a) => `${a.tempC?.toFixed(0)}°C dan ${wx(a)} ${a.hasLocation ? `di ${a.location}` : "hari ini"}. Bukan saat yang tepat untuk beraktivitas di luar.`,
  (a) => `⚠ Jangan anggap remeh cuaca ${a.hasLocation ? a.location : "hari ini"}. ${cap(wx(a))} di ${a.tempC?.toFixed(0)}°C — lebih baik aman daripada menyesal.`,
  (a) => `Situasi cuaca ${a.hasLocation ? a.location : "hari ini"} cukup genting. ${a.tempC?.toFixed(0)}°C dengan ${wx(a)} bukan kombinasi yang bisa diabaikan.`,
  (a) => `${a.tempC?.toFixed(0)}°C dan ${wx(a)} adalah perpaduan yang tidak bersahabat. Kalau tidak ada keperluan mendesak, lebih baik bertahan di dalam.`,
  (a) => `⚠ Risiko nyata ${a.hasLocation ? `di ${a.location}` : "hari ini"}: ${wx(a)}, suhu ${a.tempC?.toFixed(0)}°C. Alam sedang tidak berpihak pada aktivitas luar ruangan.`,
  (a) => `${a.hasLocation ? a.location : "Cuaca"} sedang menunjukkan sisi terburuknya. ${a.tempC?.toFixed(0)}°C, ${wx(a)} — ini bukan hari yang bersahabat.`,
  (a) => `Prioritas utama ${a.hasLocation ? `di ${a.location}` : "hari ini"} adalah keselamatan. Suhu ${a.tempC?.toFixed(0)}°C, ${wx(a)}, risiko di luar cukup nyata.`,
]

const OPENING_CUKUP: Array<(a: TemplateArgs) => string> = [
  (a) => `${lokasi(a)} ${wx(a)} di ${a.tempC?.toFixed(0)}°C. Lumayan untuk aktivitas ringan.`,
  (a) => `Cuaca ${a.hasLocation ? a.location : "hari ini"} cukup biasa, ${a.tempC?.toFixed(0)}°C. Tidak istimewa, tapi tidak mengkhawatirkan.`,
  (a) => `${a.tempC?.toFixed(0)}°C dengan ${wx(a)} ${a.hasLocation ? `di ${a.location}` : "hari ini"}. Nyaman untuk kegiatan sehari-hari.`,
  (a) => `${cap(wx(a))} menyelimuti ${a.hasLocation ? a.location : "langit hari ini"} di ${a.tempC?.toFixed(0)}°C. Tenang dan stabil.`,
  (a) => `Suhu ${a.tempC?.toFixed(0)}°C, ${wx(a)} ${a.hasLocation ? `di ${a.location}` : ""}. Hari yang standar — tidak ada yang istimewa, tidak ada yang perlu dikhawatirkan.`,
  (a) => `${a.hasLocation ? a.location : "Cuaca hari ini"} bisa dibilang pas-pasan. ${a.tempC?.toFixed(0)}°C, ${wx(a)} — cukup untuk aktivitas biasa.`,
  (a) => `${a.tempC?.toFixed(0)}°C dan ${wx(a)} ${a.hasLocation ? `di ${a.location}` : ""}. Nggak ada yang spesial, tapi nggak ada yang salah juga.`,
  (a) => `Kondisi ${wx(a)} ${a.hasLocation ? `di ${a.location}` : "hari ini"} dengan suhu ${a.tempC?.toFixed(0)}°C. Standar, seperti biasanya.`,
  (a) => `${a.tempC?.toFixed(0)}°C, ${wx(a)}, udara biasa — ${a.hasLocation ? a.location : "hari ini"} nggak punya cerita cuaca yang menarik, tapi itu bukan hal buruk.`,
  (a) => `Cuaca ${a.hasLocation ? a.location : "hari ini"} ${wx(a)}, ${a.tempC?.toFixed(0)}°C. Stabil, tenang, dan bisa diprediksi. Kadang itulah yang kita butuhkan.`,
]

// ── Suhu ekstrem ─────────────────────────────────────────────────────────────

const TEMP_SANGAT_PANAS: Array<(a: TemplateArgs) => string> = [
  (a) => `Suhu ${a.tempC?.toFixed(0)}°C berisiko heat stroke. Hindari keluar pukul 10 hingga 15.`,
  (a) => `${a.tempC?.toFixed(0)}°C terasa menyengat. Hidrasi jadi prioritas utama hari ini.`,
  (a) => `Panas ${a.tempC?.toFixed(0)}°C bisa memaksa tubuh bekerja keras. Lindungi kepala dan perbanyak minum.`,
  (a) => `Di ${a.tempC?.toFixed(0)}°C ini tubuh kehilangan cairan lebih cepat. Jangan remehkan dehidrasi.`,
  (a) => `Suhu ${a.tempC?.toFixed(0)}°C — rasanya seperti sedang dipanggang. Kalau bisa, tunda dulu aktivitas outdoor sampai sore.`,
  (a) => `${a.tempC?.toFixed(0)}°C bukan main-main. Tubuhmu butuh lebih banyak cairan dari biasanya. Jangan tunggu haus untuk minum.`,
  (a) => `Panas ekstrem ${a.tempC?.toFixed(0)}°C bisa bikin lemas dalam hitungan menit. Pastikan ada tempat teduh di dekatmu.`,
  (a) => `Udara terasa membakar di ${a.tempC?.toFixed(0)}°C. AC dan kipas angin bukan lagi kemewahan, tapi kebutuhan.`,
  (a) => `${a.tempC?.toFixed(0)}°C — suhu ini tidak bersahabat sama kulit. Tabir surya wajib, topi juga.`,
  (a) => `Bayangkan ${a.tempC?.toFixed(0)}°C tanpa angin sepoi — ya, hari ini seperti itu. Lindungi diri dari sengatan langsung.`,
]

const TEMP_PANAS: Array<(a: TemplateArgs) => string> = [
  (a) => `Suhu ${a.tempC?.toFixed(0)}°C cukup terik. Jaga asupan air agar tetap bugar.`,
  (a) => `${a.tempC?.toFixed(0)}°C terasa hangat menyengat. Hindari aktivitas berat saat puncak terik.`,
  (a) => `Di ${a.tempC?.toFixed(0)}°C ini keringat lebih deras dari biasanya. Pastikan hidrasi terjaga.`,
  (a) => `${a.tempC?.toFixed(0)}°C terasa seperti ada di dekat oven. Masih bisa ditoleransi, tapi jangan paksakan diri saat siang.`,
  (a) => `Cuaca hangat ${a.tempC?.toFixed(0)}°C — udaranya terasa berat, tapi belum sampai tahap membahayakan. Bawa air kemana pun kamu pergi.`,
  (a) => `Suhu ${a.tempC?.toFixed(0)}°C artinya kipas angin akan jadi teman terbaikmu hari ini. Jangan lupa minum.`,
  (a) => `Panas ${a.tempC?.toFixed(0)}°C — masih masuk akal, tapi tubuh tetap perlu dijaga. Istirahat di tempat teduh kalau mulai pusing.`,
  (a) => `${a.tempC?.toFixed(0)}°C, langit cerah, sinar matahari terasa langsung ke kulit. SPF minimal 30, ya.`,
]

const TEMP_SANGAT_DINGIN: Array<(a: TemplateArgs) => string> = [
  (a) => `${a.tempC?.toFixed(0)}°C terasa menggigit. Pakaian berlapis hari ini bukan pilihan, melainkan keharusan.`,
  (a) => `Suhu ${a.tempC?.toFixed(0)}°C, pastikan seluruh tubuh terlindungi sebelum keluar.`,
  (a) => `${a.tempC?.toFixed(0)}°C di luar bisa terasa jauh lebih dingin dengan angin. Berpakaian hangat.`,
  (a) => `${a.tempC?.toFixed(0)}°C — dinginnya menusuk sampai ke tulang. Kalau bisa, stay di rumah dengan minuman hangat.`,
  (a) => `Suhu ${a.tempC?.toFixed(0)}°C, angin menambah efek dingin yang signifikan. Lapisan jaket tebal wajib hari ini.`,
  (a) => `Hari ini ${a.tempC?.toFixed(0)}°C — bukan suhu yang biasa buat Indonesia. Siapkan selimut dan jaket ekstra.`,
  (a) => `${a.tempC?.toFixed(0)}°C dan udara dingin menusuk. Tubuh butuh energi ekstra untuk tetap hangat, jangan lupa sarapan.`,
  (a) => `Dingin ${a.tempC?.toFixed(0)}°C membuat tangan dan kaki cepat mati rasa. Sarung tangan bukan lagi aksesori, tapi perlindungan.`,
]

// ── Kelembapan ────────────────────────────────────────────────────────────────

const HUMIDITY_SANGAT_LEMBAP: Array<(a: TemplateArgs) => string> = [
  (a) => `Kelembapan ${a.humidity}% membuat udara terasa berat dan gerah.`,
  (a) => `${a.humidity}% kelembapan cukup ekstrem. Risiko dehidrasi tersembunyi meski tidak terasa haus.`,
  (a) => `Udara lembap hingga ${a.humidity}%. Kurangi aktivitas fisik intens hari ini.`,
  (a) => `Bahkan tanpa bergerak, keringat tetap keluar di kelembapan ${a.humidity}%. Tubuh bekerja ekstra untuk mendinginkan diri.`,
  (a) => `Kelembapan ${a.humidity}% — rasanya seperti berenang di udara. Jaket tipis pun terasa terlalu berat.`,
  (a) => `${a.humidity}% kelembapan bikin udara terasa lengket dan sesak. Minum lebih banyak dari biasanya.`,
  (a) => `Udara lembap ${a.humidity}% membuat tidur siang terasa pengap. Pastikan sirkulasi udara di ruangan cukup baik.`,
]

const HUMIDITY_KERING: Array<(a: TemplateArgs) => string> = [
  (a) => `Udara kering di ${a.humidity}%. Tenggorokan dan kulit bisa terasa tidak nyaman, perbanyak minum.`,
  (a) => `${a.humidity}% kelembapan terhitung rendah. Pertimbangkan pelembap dan perbanyak asupan cairan.`,
  (a) => `Udara kering ${a.humidity}% — kulit dan bibir cepat terasa kering. Bawalah pelembap bibir kemana pun.`,
  (a) => `Kelembapan hanya ${a.humidity}%. Mata dan tenggorokan mungkin terasa gatal. Tetes mata bisa membantu.`,
  (a) => `Kering hingga ${a.humidity}%. Debu lebih mudah beterbangan, masker mungkin perlu kalau kamu sensitif.`,
]

// ── Angin ─────────────────────────────────────────────────────────────────────

const WIND_BADAI: Array<(a: TemplateArgs) => string> = [
  (a) => `Angin ${a.windSpeed?.toFixed(0)} m/s cukup kuat untuk merubuhkan dahan. Jauhi area terbuka.`,
  (a) => `${a.windSpeed?.toFixed(0)} m/s bukan angin sepoi. Tetap di dalam dan jauh dari jendela.`,
  (a) => `Badai angin ${a.windSpeed?.toFixed(0)} m/s sedang melanda. Amankan benda ringan di luar.`,
  (a) => `Angin ${a.windSpeed?.toFixed(0)} m/s — pohon dan baliho bisa tumbang kapan saja. Jangan berteduh di bawah papan reklame.`,
  (a) => `Hari ini angin bertiup sangat kencang, ${a.windSpeed?.toFixed(0)} m/s. Kalau sedang di jalan, hindari area pepohonan rimbun.`,
  (a) => `Angin ${a.windSpeed?.toFixed(0)} m/s — helm dan jaket terasa seperti layar perahu. Berkendara butuh keseimbangan ekstra.`,
  (a) => `Angin kencang ${a.windSpeed?.toFixed(0)} m/s membawa risiko serius. Benda ringan di balkon atau halaman sebaiknya diamankan.`,
]

const WIND_KENCANG: Array<(a: TemplateArgs) => string> = [
  (a) => `Angin kencang ${a.windSpeed?.toFixed(0)} m/s. Waspada pohon tumbang dan papan reklame.`,
  (a) => `${a.windSpeed?.toFixed(0)} m/s terasa berat untuk berkendara motor. Hati-hati di jalan.`,
  (a) => `Angin ${a.windSpeed?.toFixed(0)} m/s hari ini. Pegang erat barang bawaan di luar.`,
  (a) => `Angin berhembus cukup kencang, ${a.windSpeed?.toFixed(0)} m/s. Topi dan payung mungkin nggak akan bertahan lama.`,
  (a) => `Angin ${a.windSpeed?.toFixed(0)} m/s — rambut bakal berantakan dan debu beterbangan. Siap-siap kalau keluar.`,
  (a) => `Angin ${a.windSpeed?.toFixed(0)} m/s bikin jalan kaki terasa lebih berat. Tapi masih aman selama nggak ada pohon rapuh di sekitar.`,
  (a) => `Angin hari ini cukup terasa, ${a.windSpeed?.toFixed(0)} m/s. Perhatikan barang ringan di sekitar rumah.`,
]

// ── Hujan ─────────────────────────────────────────────────────────────────────

const RAIN_TINGGI: Array<(a: TemplateArgs) => string> = [
  (a) => `Hujan hampir pasti turun, peluang ${a.pop}%${a.precipMm && a.precipMm > 0 ? ` dengan estimasi ${a.precipMm} mm` : ""}. Bawa jas hujan.`,
  (a) => `Peluang hujan ${a.pop}%${a.precipMm && a.precipMm > 0 ? `, potensi curah ${a.precipMm} mm` : ""}. Hampir tidak bisa dihindari hari ini.`,
  (a) => `${a.pop}% kemungkinan hujan turun. Jangan keluar tanpa perlindungan.`,
  (a) => `Awan hujan sudah mengumpul, peluang ${a.pop}%${a.precipMm && a.precipMm > 0 ? ` sebanyak ${a.precipMm} mm` : ""}. Siapkan jas hujan.`,
  (a) => `Langit sudah gelap, peluang hujan ${a.pop}%. Sepertinya hujan bukan lagi kemungkinan — tinggal menunggu waktu.`,
  (a) => `${a.pop}% — hampir pasti basah kalau keluar tanpa pelindung. Jas hujan atau payung besar, pilih sendiri.`,
  (a) => `Peluang hujan ${a.pop}%${a.precipMm && a.precipMm > 0 ? `, intensitas ${a.precipMm} mm` : ""}. Kalau memungkinkan, tunda dulu perjalanan yang nggak urgent.`,
  (a) => `Hujan ${a.pop}% siap turun kapan saja. Hari seperti ini enaknya bikin kopi dan duduk di teras.`,
]

const RAIN_LEBAT: Array<(a: TemplateArgs) => string> = [
  (a) => `Curah hujan ${a.precipMm} mm masuk kategori lebat. Waspadai genangan dan banjir lokal.`,
  (a) => `${a.precipMm} mm bukan sekadar gerimis. Banjir lokal menjadi risiko nyata di titik rendah.`,
  (a) => `Air sebanyak ${a.precipMm} mm bakal turun — jalanan bisa berubah jadi sungai dalam hitungan jam. Hindari area rendah.`,
  (a) => `Hujan lebat ${a.precipMm} mm membuat visibilitas menurun drastis. Kalau sedang di jalan, cari tempat aman untuk berteduh.`,
  (a) => `${a.precipMm} mm — ini bukan hujan biasa. Genangan di jalan bisa mencapai lutuh. Siapkan sepatu bot.`,
]

const RAIN_SEDANG: Array<(a: TemplateArgs) => string> = [
  (a) => `Peluang hujan ${a.pop}%. Bawa payung sebagai antisipasi.`,
  (a) => `Ada kemungkinan ${a.pop}% hujan hari ini. Payung kecil di tas tidak ada salahnya.`,
  (a) => `${a.pop}% kemungkinan gerimis. Antisipasi dengan payung jika bepergian jauh.`,
  (a) => `Langit agak mendung, peluang hujan ${a.pop}%. Mungkin cuma gerimis, tapi mending siap-siap.`,
  (a) => `${a.pop}% — hujan masih 50:50. Payung lipat di tas jadi penyelamat dadakan.`,
  (a) => `Kemungkinan hujan ${a.pop}%. Nggak perlu khawatir berlebihan, tapi kalau bepergian jauh, payung adalah teman setia.`,
]

// ── UV ────────────────────────────────────────────────────────────────────────

const UV_EKSTREM: Array<(a: TemplateArgs) => string> = [
  (a) => `UV index ${a.uvi} masuk level ekstrem. Hindari paparan langsung pukul 10 hingga 16 dan pakai SPF 50+.`,
  (a) => `UV ${a.uvi} bisa merusak kulit dalam hitungan menit tanpa perlindungan. Jangan remehkan.`,
  (a) => `UV ${a.uvi} ekstrem hari ini. Tabir surya, kacamata, dan penutup kepala wajib jika harus keluar.`,
  (a) => `UV ${a.uvi} — tingkat yang sama seriusnya dengan berada di atas gunung tanpa pelindung. Kulit bisa terbakar dalam 10 menit.`,
  (a) => `Paparan UV ${a.uvi} termasuk yang paling berbahaya. Bayangkan kulitmu terkena sinar langsung selama 15 menit — efeknya terasa sampai malam.`,
  (a) => `UV ${a.uvi}: tabir surya SPF 50+ bukan saran, tapi kewajiban. Ditambah topi lebar kalau bisa.`,
  (a) => `Sinar UV hari ini mencapai ${a.uvi} — level yang bisa meninggalkan bekas terbakar. Lindungi area leher dan telinga yang sering terlewat.`,
]

const UV_SANGAT_TINGGI: Array<(a: TemplateArgs) => string> = [
  (a) => `UV index ${a.uvi} sangat tinggi. Aplikasikan ulang tabir surya SPF 50+ setiap dua jam.`,
  (a) => `Paparan UV ${a.uvi} bisa membakar kulit lebih cepat dari yang kamu kira. Pakai perlindungan lengkap.`,
  (a) => `UV ${a.uvi} cukup serius. Hindari keluar tanpa tabir surya, terutama saat siang.`,
  (a) => `UV ${a.uvi} — kulit bisa merah meski cuma 20 menit di bawah sinar langsung. SPF minimal 30, topi, dan kacamata.`,
  (a) => `UV hari ini ${a.uvi}. Kalau kamu punya riwayat kulit sensitif, sebaiknya hindari sinar langsung antara jam 11-15.`,
  (a) => `UV ${a.uvi} — bukan level untuk jalan-jalan santai tanpa perlindungan. Aplikasikan ulang tabir surya secara berkala.`,
]

// ── Visibilitas ───────────────────────────────────────────────────────────────

const VIS_BURUK: Array<(a: TemplateArgs) => string> = [
  (a) => `Jarak pandang hanya ${a.visKm} km. Nyalakan lampu kendaraan dan kurangi kecepatan.`,
  (a) => `Visibilitas terbatas ${a.visKm} km. Berkendara butuh ekstra kewaspadaan hari ini.`,
  (a) => `Kabut memangkas jarak pandang hingga ${a.visKm} km. Jaga jarak aman antar kendaraan.`,
  (a) => `Jarak pandang cuma ${a.visKm} km — seperti berkendara dalam nektar. Lampu kabut wajib dinyalakan.`,
  (a) => `Visibilitas ${a.visKm} km, kabut cukup tebal. Kalau bisa tunda perjalanan sampai kabut sedikit menyusut.`,
  (a) => `Hanya ${a.visKm} km jarak pandang — jalanan tidak seaman biasanya. Kurangi kecepatan dan jaga jarak.`,
  (a) => `Visibilitas ${a.visKm} km, disarankan menggunakan jalur alternatif yang lebih terang dan bebas kabut.`,
]

// ─────────────────────────────────────────────────────────────────────────────
// Mesin NLG
// ─────────────────────────────────────────────────────────────────────────────

function generateNlgSentences(
  stemmed: StemmedWeather,
  tokens: WeatherToken[],
  topTerms: TfIdfTerm[]
): NlgSentence[] {
  const sentences: NlgSentence[] = []
  const concepts = stemmed.concepts
  const sentiment = stemmed.overallSentiment

  const getNum = (key: string): number | undefined => {
    const t = tokens.find(tk => tk.key === key)
    return t ? Number(t.rawValue) : undefined
  }
  const getStr = (key: string): string | undefined => {
    const t = tokens.find(tk => tk.key === key)
    return t ? String(t.rawValue) : undefined
  }

  const seed = seedFromTokens(stemmed.location, tokens)

  // Resolusi nama lokasi — buang jika koordinat
  const locationHuman = humanLocation(stemmed.location)

  // Label cuaca dalam Bahasa Indonesia
  const wxSlug = getStr("weather_primary") ?? ""
  const wxLabelResolved = wxLabelId(wxSlug)

  const args: TemplateArgs = {
    location: locationHuman || "Cuaca hari ini",
    hasLocation: locationHuman.length > 0,
    tempC: getNum("temp_c"),
    humidity: getNum("humidity_pct"),
    windSpeed: getNum("wind_speed_kph") !== undefined
      ? (getNum("wind_speed_kph")! / 3.6)
      : undefined,
    windDir: getStr("wind_dir"),
    windGust: getNum("wind_gust_kph") !== undefined
      ? (getNum("wind_gust_kph")! / 3.6)
      : undefined,
    uvi: getNum("uvi"),
    visKm: getNum("visibility_km"),
    pop: getNum("pop_pct"),
    precipMm: getNum("precip_mm"),
    wxLabel: wxLabelResolved,
    seed,
  }

  const hasConcept = (c: string) => concepts.some(k => k.concept === c)
  const conceptWeight = (c: string): number =>
    concepts.find(k => k.concept === c)?.weight ?? 0

  // ── Opening ────────────────────────────────────────────────────────────────
  const openingBanks: Record<string, Array<(a: TemplateArgs) => string>> = {
    baik: OPENING_BAIK,
    waspada: OPENING_WASPADA,
    berbahaya: OPENING_BERBAHAYA,
    cukup: OPENING_CUKUP,
  }
  const openingBank = openingBanks[sentiment] ?? OPENING_CUKUP
  sentences.push({
    type: "opening",
    text: pick(openingBank, seed, 0)(args),
    weight: 1.0,
  })

  // ── Suhu ekstrem ───────────────────────────────────────────────────────────
  if (hasConcept("sangat_panas")) {
    sentences.push({ type: "condition", text: pick(TEMP_SANGAT_PANAS, seed, 1)(args), weight: 0.95 })
  } else if (hasConcept("sangat_dingin")) {
    sentences.push({ type: "condition", text: pick(TEMP_SANGAT_DINGIN, seed, 1)(args), weight: 0.90 })
  } else if (hasConcept("panas")) {
    sentences.push({ type: "condition", text: pick(TEMP_PANAS, seed, 1)(args), weight: 0.80 })
  }

  // ── Kelembapan ekstrem ─────────────────────────────────────────────────────
  if (hasConcept("sangat_lembap")) {
    sentences.push({ type: "condition", text: pick(HUMIDITY_SANGAT_LEMBAP, seed, 2)(args), weight: 0.75 })
  } else if (hasConcept("sangat_kering")) {
    sentences.push({ type: "condition", text: pick(HUMIDITY_KERING, seed, 2)(args), weight: 0.72 })
  }

  // ── Angin berbahaya ────────────────────────────────────────────────────────
  if (hasConcept("badai")) {
    sentences.push({ type: "wind", text: pick(WIND_BADAI, seed, 3)(args), weight: 1.0 - conceptWeight("badai") + 0.1 })
  } else if (hasConcept("angin_kencang")) {
    sentences.push({ type: "wind", text: pick(WIND_KENCANG, seed, 3)(args), weight: 0.85 })
  }

  // ── Hujan ──────────────────────────────────────────────────────────────────
  const rainConcept = concepts.find(c =>
    ["hampir_pasti_hujan", "kemungkinan_hujan"].includes(c.concept)
  )
  if (rainConcept) {
    const pop = args.pop ?? 0
    if (pop > 80 || rainConcept.concept === "hampir_pasti_hujan") {
      sentences.push({ type: "rain", text: pick(RAIN_TINGGI, seed, 4)(args), weight: 0.90 })
    } else {
      sentences.push({ type: "rain", text: pick(RAIN_SEDANG, seed, 4)(args), weight: 0.70 })
    }
  }

  if (args.precipMm && args.precipMm >= 10 && hasConcept("hampir_pasti_hujan")) {
    sentences.push({ type: "rain", text: pick(RAIN_LEBAT, seed, 5)(args), weight: 0.88 })
  }

  // ── UV tinggi ──────────────────────────────────────────────────────────────
  if (hasConcept("uv_ekstrem")) {
    sentences.push({ type: "uv", text: pick(UV_EKSTREM, seed, 6)(args), weight: 0.95 })
  } else if (hasConcept("uv_sangat_tinggi")) {
    sentences.push({ type: "uv", text: pick(UV_SANGAT_TINGGI, seed, 6)(args), weight: 0.80 })
  }

  // ── Visibilitas buruk ──────────────────────────────────────────────────────
  if (hasConcept("jarak_pandang_buruk")) {
    sentences.push({ type: "condition", text: pick(VIS_BURUK, seed, 7)(args), weight: 0.85 })
  }

  // Urutkan: opening tetap pertama, sisanya by weight DESC
  const opening = sentences.filter(s => s.type === "opening")
  const middle = sentences
    .filter(s => s.type !== "opening")
    .sort((a, b) => b.weight - a.weight)

  return [...opening, ...middle]
}

// ─────────────────────────────────────────────────────────────────────────────
// Perakit narasi — max 3 kalimat
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BODY_SENTENCES = 2

function buildNarrative(sentences: NlgSentence[]): string {
  const opening = sentences.find(s => s.type === "opening")
  const body = sentences
    .filter(s => s.type !== "opening" && s.type !== "closing")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_BODY_SENTENCES)

  const all = opening ? [opening, ...body] : body
  if (all.length === 0) return ""
  return all.map(s => s.text).join(" ").trim()
}

function buildKeyPhrase(topTerms: TfIdfTerm[], concepts: StemmedConcept[]): string {
  const top3 = topTerms.slice(0, 3)
  const labels = top3
    .map(t => concepts.find(c => c.concept === t.term)?.humanLabel ?? t.term)
    .filter(Boolean)

  if (labels.length === 0) return "Kondisi cuaca normal"
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} · ${labels[1]}`
  return `${labels[0]} · ${labels[1]} · ${labels[2]}`
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PROCESSOR
// ─────────────────────────────────────────────────────────────────────────────

export function processNlp(
  tokens: WeatherToken[],
  stemmed: StemmedWeather,
  dateISO?: string,
): ProcessedNlp {
  // ── Step 1: Normalization ─────────────────────────────────────────────────
  const rawTextTokens = tokens.map(t => t.textToken)
  const { normalized, removedStopwords } = normalizeTokens(rawTextTokens)

  // ── Step 2: N-gram ────────────────────────────────────────────────────────
  const labelTokens = normalized.filter(t => !NUMERIC_RE.test(t))
  const bigrams = buildNgrams(labelTokens, 2)
  const trigrams = buildNgrams(labelTokens, 3)
  const allNgrams = [...bigrams, ...trigrams].sort((a, b) => b.score - a.score)
  const topNgrams = allNgrams.slice(0, 5)

  // ── Step 3: TF-IDF ────────────────────────────────────────────────────────
  const tfIdfTerms = computeTfIdf(normalized, stemmed.concepts)
  const topTerms = tfIdfTerms.slice(0, 5)

  // ── Step 4: NLG ───────────────────────────────────────────────────────────
  const seedTokens = dateISO
    ? [...tokens, { key: "_date", rawValue: dateISO, unit: "", textToken: dateISO, category: "location" as const }]
    : tokens
  const seed = seedFromTokens(stemmed.location, seedTokens)
  const sentences = generateNlgSentences(stemmed, seedTokens, topTerms)
  const narrative = buildNarrative(sentences)
  const keyPhrase = buildKeyPhrase(topTerms, stemmed.concepts)

  return {
    normalizedTokens: normalized,
    removedStopwords,
    bigrams,
    trigrams,
    topNgrams,
    tfIdfTerms,
    topTerms,
    sentences,
    narrative,
    keyPhrase,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utiliti ekspor
// ─────────────────────────────────────────────────────────────────────────────

export function getSentencesByType(
  processed: ProcessedNlp,
  type: NlgSentence["type"]
): NlgSentence[] {
  return processed.sentences.filter(s => s.type === type)
}

export function getTopNgrams(processed: ProcessedNlp, n = 5): Ngram[] {
  return [...processed.bigrams, ...processed.trigrams]
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
}

export function getSignificantTerms(
  processed: ProcessedNlp,
  threshold = 0.05
): TfIdfTerm[] {
  return processed.tfIdfTerms.filter(t => t.tfidf >= threshold)
}