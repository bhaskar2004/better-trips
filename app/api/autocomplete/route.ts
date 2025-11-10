import { type NextRequest, NextResponse } from "next/server"

const API_KEY = process.env.GEOAPIFY_API_KEY

interface GeoapifyFeature {
  properties: {
    name?: string
    formatted?: string
    state?: string
    country?: string
    city?: string
  }
}

interface Suggestion {
  name: string
  state: string
  country: string
  displayName: string
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    if (!API_KEY) {
      return NextResponse.json({ suggestions: [], error: "server api key missing" }, { status: 500 })
    }

    // Use Geoapify autocomplete API with bias towards India
    const autocompleteUrl = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&bias=countrycode:in&filter=countrycode:in&limit=5&apiKey=${API_KEY}`

    const response = await fetch(autocompleteUrl)

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] })
    }

    const data = await response.json()

    const suggestions =
      data.features
        ?.map((feature: GeoapifyFeature) => ({
          name: feature.properties.formatted || feature.properties.name || "",
          state: feature.properties.state || "",
          country: feature.properties.country || "",
          displayName: `${feature.properties.name || feature.properties.city || ""}, ${feature.properties.state || ""}`
            .replace(/^,\s*/, "")
            .replace(/,\s*$/, ""),
        }))
        .filter((suggestion: Suggestion) => suggestion.name && suggestion.displayName) || []

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("Autocomplete error:", error)
    return NextResponse.json({ suggestions: [] })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || ""

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    if (!API_KEY) {
      return NextResponse.json({ suggestions: [], error: "server api key missing" }, { status: 500 })
    }

    const autocompleteUrl = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&bias=countrycode:in&filter=countrycode:in&limit=5&apiKey=${API_KEY}`
    const response = await fetch(autocompleteUrl)

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] })
    }

    const data = await response.json()

    const suggestions =
      data.features
        ?.map((feature: GeoapifyFeature) => ({
          name: feature.properties.formatted || feature.properties.name || "",
          state: feature.properties.state || "",
          country: feature.properties.country || "",
          displayName: `${feature.properties.name || feature.properties.city || ""}, ${feature.properties.state || ""}`
            .replace(/^,\s*/, "")
            .replace(/,\s*$/, ""),
        }))
        .filter((suggestion: Suggestion) => suggestion.name && suggestion.displayName) || []

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("Autocomplete GET error:", error)
    return NextResponse.json({ suggestions: [] })
  }
}
