import { type NextRequest, NextResponse } from "next/server"

const API_KEY = "b3f3aa9a1fcd4879a30115e8328ffe57"

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] })
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
        ?.map((feature: any) => ({
          name: feature.properties.formatted || feature.properties.name || "",
          state: feature.properties.state || "",
          country: feature.properties.country || "",
          displayName: `${feature.properties.name || feature.properties.city || ""}, ${feature.properties.state || ""}`
            .replace(/^,\s*/, "")
            .replace(/,\s*$/, ""),
        }))
        .filter((suggestion: any) => suggestion.name && suggestion.displayName) || []

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("Autocomplete error:", error)
    return NextResponse.json({ suggestions: [] })
  }
}
