import { type NextRequest, NextResponse } from "next/server"

interface GeoapifyPlace {
  properties: {
    name?: string
    categories: string[]
    address_line1?: string
    address_line2?: string
    city?: string
    country?: string
    formatted?: string
    lat?: number
    lon?: number
  }
}

interface ProcessedPlace {
  name: string
  categories: string[]
  address: string
  lat: number | undefined
  lon: number | undefined
  priority: number
}

const API_KEY = process.env.GEOAPIFY_API_KEY
const cache = new Map<string, { data: unknown; ts: number }>()
const TTL_MS = 120000

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const latStr = searchParams.get("lat")
    const lonStr = searchParams.get("lon")

    if (!latStr || !lonStr) {
      return NextResponse.json({ error: "lat and lon are required" }, { status: 400 })
    }

    const lat = parseFloat(latStr)
    const lon = parseFloat(lonStr)

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: "invalid coordinates" }, { status: 400 })
    }

    if (!API_KEY) {
      return NextResponse.json({ error: "server api key missing" }, { status: 500 })
    }

    const radius = 20000
    const key = `${lat.toFixed(3)}|${lon.toFixed(3)}|${radius}`
    const now = Date.now()
    const hit = cache.get(key)
    if (hit && now - hit.ts < TTL_MS) {
      return NextResponse.json(hit.data)
    }
    const placesUrl = `https://api.geoapify.com/v2/places?categories=tourism.attraction,tourism.sights,entertainment.museum,entertainment.culture,entertainment.zoo,entertainment.aquarium,natural,heritage&filter=circle:${lon},${lat},${radius}&limit=20&apiKey=${API_KEY}`

    const placesResponse = await fetch(placesUrl)
    if (!placesResponse.ok) {
      const errorText = await placesResponse.text()
      throw new Error(`Failed to fetch nearby places: ${placesResponse.status} - ${errorText}`)
    }

    const placesData = await placesResponse.json()

    const places: ProcessedPlace[] =
      placesData.features
        ?.map((place: GeoapifyPlace) => {
          const nameRaw = place.properties.name || ""
          const name = nameRaw && nameRaw !== "Unnamed Place" ? nameRaw : "Point of Interest"

          let priority = 50
          const categories = place.properties.categories || []
          if (categories.includes("tourism.attraction")) priority += 20
          if (categories.includes("tourism.sights")) priority += 15
          if (categories.includes("entertainment.museum")) priority += 10
          if (categories.includes("natural")) priority += 8
          if (categories.includes("heritage")) priority += 12
          if (name && name !== "Tourist Attraction" && name !== "Point of Interest") {
            priority += 10
          }

          return {
            name,
            categories,
            address:
              place.properties.formatted ||
              place.properties.address_line1 ||
              `${place.properties.city || ""}, ${place.properties.country || ""}`.trim().replace(/^,\s*/, ""),
            lat: place.properties.lat,
            lon: place.properties.lon,
            priority,
          }
        })
        .filter((p: ProcessedPlace) => p.name && p.name.trim().length > 0)
        .sort((a: ProcessedPlace, b: ProcessedPlace) => b.priority - a.priority) || []

    const payload = { success: true, location: { lat, lon }, places }
    cache.set(key, { data: payload, ts: now })
    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch nearby places",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
