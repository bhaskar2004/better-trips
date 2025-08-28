import { type NextRequest, NextResponse } from "next/server"

const API_KEY = "b3f3aa9a1fcd4879a30115e8328ffe57"

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
    datasource?: {
      raw?: {
        rating?: number
        name?: string
        alt_name?: string
        official_name?: string
        loc_name?: string
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] API route called")
    const { placeName } = await request.json()
    console.log("[v0] Place name received:", placeName)

    if (!placeName) {
      return NextResponse.json({ error: "Place name is required" }, { status: 400 })
    }

    const normalizedPlaceName = placeName.trim().toLowerCase().replace(/\s+/g, " ")

    const placeVariations: { [key: string]: string } = {
      // Famous pilgrimage and tourist destinations
      mantralaya: "Mantralayam, Andhra Pradesh, India",
      mantralayam: "Mantralayam, Andhra Pradesh, India",
      tirupati: "Tirupati, Andhra Pradesh, India",
      hampi: "Hampi, Karnataka, India",
      mysore: "Mysuru, Karnataka, India",
      mysuru: "Mysuru, Karnataka, India",
      bangalore: "Bengaluru, Karnataka, India",
      bengaluru: "Bengaluru, Karnataka, India",

      "sjc institute": "Sri Jagadguru Chandrashekaranatha Swamiji Institute of Technology, Karnataka, India",
      "sjc institute of technology":
        "Sri Jagadguru Chandrashekaranatha Swamiji Institute of Technology, Karnataka, India",
      sjcit: "Sri Jagadguru Chandrashekaranatha Swamiji Institute of Technology, Karnataka, India",
      rvce: "RV College of Engineering, Bangalore, Karnataka, India",
      "rv college": "RV College of Engineering, Bangalore, Karnataka, India",
      pesit: "PES Institute of Technology, Bangalore, Karnataka, India",
      "pes institute": "PES Institute of Technology, Bangalore, Karnataka, India",
      "bit mesra": "Birla Institute of Technology, Mesra, Jharkhand, India",
      "nit trichy": "National Institute of Technology, Tiruchirappalli, Tamil Nadu, India",
      "nit warangal": "National Institute of Technology, Warangal, Telangana, India",
      "iit madras": "Indian Institute of Technology, Chennai, Tamil Nadu, India",
      "iit bombay": "Indian Institute of Technology, Mumbai, Maharashtra, India",
      "iit delhi": "Indian Institute of Technology, Delhi, India",
      "iit kanpur": "Indian Institute of Technology, Kanpur, Uttar Pradesh, India",
      "iit kharagpur": "Indian Institute of Technology, Kharagpur, West Bengal, India",
      "iit roorkee": "Indian Institute of Technology, Roorkee, Uttarakhand, India",
      "iit guwahati": "Indian Institute of Technology, Guwahati, Assam, India",
      "iit hyderabad": "Indian Institute of Technology, Hyderabad, Telangana, India",
      "iisc bangalore": "Indian Institute of Science, Bangalore, Karnataka, India",
      iisc: "Indian Institute of Science, Bangalore, Karnataka, India",

      // Major cities with their correct states to prevent wrong geocoding
      warangal: "Warangal, Telangana, India",
      hyderabad: "Hyderabad, Telangana, India",
      vijayawada: "Vijayawada, Andhra Pradesh, India",
      visakhapatnam: "Visakhapatnam, Andhra Pradesh, India",
      guntur: "Guntur, Andhra Pradesh, India",
      nellore: "Nellore, Andhra Pradesh, India",
      kurnool: "Kurnool, Andhra Pradesh, India",
      rajahmundry: "Rajahmundry, Andhra Pradesh, India",
      kakinada: "Kakinada, Andhra Pradesh, India",
      nizamabad: "Nizamabad, Telangana, India",
      karimnagar: "Karimnagar, Telangana, India",
      khammam: "Khammam, Telangana, India",
      mahbubnagar: "Mahbubnagar, Telangana, India",

      // Major cities in other states
      chennai: "Chennai, Tamil Nadu, India",
      madurai: "Madurai, Tamil Nadu, India",
      coimbatore: "Coimbatore, Tamil Nadu, India",
      salem: "Salem, Tamil Nadu, India",
      tiruchirappalli: "Tiruchirappalli, Tamil Nadu, India",
      trichy: "Tiruchirappalli, Tamil Nadu, India",

      kochi: "Kochi, Kerala, India",
      thiruvananthapuram: "Thiruvananthapuram, Kerala, India",
      kozhikode: "Kozhikode, Kerala, India",
      thrissur: "Thrissur, Kerala, India",

      mumbai: "Mumbai, Maharashtra, India",
      pune: "Pune, Maharashtra, India",
      nagpur: "Nagpur, Maharashtra, India",
      nashik: "Nashik, Maharashtra, India",
      aurangabad: "Aurangabad, Maharashtra, India",

      // States - direct mapping
      goa: "Goa, India",
      kerala: "Kerala, India",
      karnataka: "Karnataka, India",
      "tamil nadu": "Tamil Nadu, India",
      "andhra pradesh": "Andhra Pradesh, India",
      telangana: "Telangana, India",
      maharashtra: "Maharashtra, India",
      gujarat: "Gujarat, India",
      rajasthan: "Rajasthan, India",
      "uttar pradesh": "Uttar Pradesh, India",
      "madhya pradesh": "Madhya Pradesh, India",
      bihar: "Bihar, India",
      "west bengal": "West Bengal, India",
      odisha: "Odisha, India",
      jharkhand: "Jharkhand, India",
      chhattisgarh: "Chhattisgarh, India",
      punjab: "Punjab, India",
      haryana: "Haryana, India",
      himachal: "Himachal Pradesh, India",
      "himachal pradesh": "Himachal Pradesh, India",
      uttarakhand: "Uttarakhand, India",
      assam: "Assam, India",
      manipur: "Manipur, India",
      meghalaya: "Meghalaya, India",
      tripura: "Tripura, India",
      mizoram: "Mizoram, India",
      nagaland: "Nagaland, India",
      arunachal: "Arunachal Pradesh, India",
      "arunachal pradesh": "Arunachal Pradesh, India",
      sikkim: "Sikkim, India",

      // Union Territories
      delhi: "Delhi, India",
      puducherry: "Puducherry, India",
      chandigarh: "Chandigarh, India",
      "daman and diu": "Daman and Diu, India",
      "dadra and nagar haveli": "Dadra and Nagar Haveli, India",
      lakshadweep: "Lakshadweep, India",
      "andaman and nicobar": "Andaman and Nicobar Islands, India",
      ladakh: "Ladakh, India",
      "jammu and kashmir": "Jammu and Kashmir, India",
    }

    let geoData = null

    const getSearchQueries = (place: string): string[] => {
      const normalizedInput = place.trim().toLowerCase().replace(/\s+/g, " ")

      // Check for partial matches in place variations
      for (const [key, value] of Object.entries(placeVariations)) {
        const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, " ")
        if (normalizedKey.startsWith(normalizedInput) && normalizedInput.length >= 3) {
          console.log(`[v0] Partial match found: "${normalizedInput}" -> "${normalizedKey}" -> "${value}"`)
          return [value]
        }
      }

      // If we have a specific variation, use it first
      if (placeVariations[normalizedInput]) {
        return [placeVariations[normalizedInput]]
      }

      // Detect if it's likely a state/UT/country by checking common patterns
      const isLikelyState = place.length > 3 && !place.includes(" district") && !place.includes(" taluk")
      const isLikelyDistrict = place.includes("district") || place.length < 15

      const queries: string[] = []

      // Strategy 1: Try as exact administrative unit
      if (isLikelyState) {
        queries.push(`${place}, India`) // State/UT level
      }

      // Strategy 2: Try as major city/district
      queries.push(`${place} district, India`)
      queries.push(`${place} city, India`)

      // Strategy 3: Try with major South Indian states (common tourist regions)
      const majorStates = ["Karnataka", "Andhra Pradesh", "Tamil Nadu", "Kerala", "Telangana", "Goa"]
      majorStates.forEach((state) => {
        queries.push(`${place}, ${state}, India`)
      })

      // Strategy 4: Try as taluk/subdivision
      queries.push(`${place} taluk, Karnataka, India`)
      queries.push(`${place} taluk, Andhra Pradesh, India`)
      queries.push(`${place} taluk, Tamil Nadu, India`)

      // Strategy 5: Try with administrative suffixes
      queries.push(`${place} town, India`)
      queries.push(`${place} village, India`)
      queries.push(`${place} mandal, India`)

      // Strategy 6: Try with North Indian states for comprehensive coverage
      const northStates = ["Maharashtra", "Gujarat", "Rajasthan", "Uttar Pradesh", "Madhya Pradesh", "Delhi"]
      northStates.forEach((state) => {
        queries.push(`${place}, ${state}, India`)
      })

      // Strategy 7: Original query as fallback
      queries.push(place)

      return queries
    }

    const searchQueries = getSearchQueries(normalizedPlaceName)

    for (const query of searchQueries) {
      const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&bias=countrycode:in&filter=countrycode:in&limit=10&apiKey=${API_KEY}`
      console.log("[v0] Trying geocoding with query:", query)

      const geoResponse = await fetch(geoUrl)
      console.log("[v0] Geocoding response status:", geoResponse.status)

      if (geoResponse.ok) {
        const data = await geoResponse.json()
        if (data.features && data.features.length > 0) {
          for (const feature of data.features) {
            const { lat, lon } = feature.properties
            const placeType = feature.properties.place_type || ""
            const state = feature.properties.state || ""
            const country = feature.properties.country || ""

            if (lat >= 6 && lat <= 37 && lon >= 68 && lon <= 97 && country.toLowerCase().includes("india")) {
              const isHighPriority =
                placeType.includes("state") ||
                placeType.includes("city") ||
                placeType.includes("town") ||
                placeType.includes("district") ||
                query.includes(", India") // Direct state/UT queries

              const isMediumPriority =
                placeType.includes("village") ||
                placeType.includes("locality") ||
                state.toLowerCase().includes("andhra") ||
                state.toLowerCase().includes("karnataka") ||
                state.toLowerCase().includes("tamil") ||
                state.toLowerCase().includes("kerala") ||
                state.toLowerCase().includes("telangana") ||
                state.toLowerCase().includes("goa")

              geoData = { features: [feature] }
              console.log("[v0] Geocoding successful with query:", query)
              console.log("[v0] Verified Indian location:", { lat, lon, state, placeType, country })

              // Break early for high priority matches (states, major cities)
              if (isHighPriority) {
                console.log("[v0] High priority match found, using this location")
                break
              }

              // Continue searching for better matches if only medium priority
              if (isMediumPriority) {
                console.log("[v0] Medium priority match found, continuing search for better match")
                // Don't break, continue searching
              }
            } else {
              console.log("[v0] Location outside India or invalid country, trying next:", { lat, lon, country })
            }
          }

          // If we found a high priority match, stop searching
          if (geoData && searchQueries.indexOf(query) < 5) {
            // First 5 queries are high priority
            break
          }
        }
      }
    }

    if (!geoData || !geoData.features || geoData.features.length === 0) {
      return NextResponse.json(
        {
          error: "Location not found",
          message: `Could not find location "${normalizedPlaceName}" in India. Please try with a more specific location name or include district/state.`,
        },
        { status: 404 },
      )
    }

    const { lat, lon } = geoData.features[0].properties
    console.log("[v0] Coordinates found:", { lat, lon })

    const radius = 20000 // 20km radius
    const placesUrl = `https://api.geoapify.com/v2/places?categories=tourism.attraction,tourism.sights,entertainment.museum,entertainment.culture,entertainment.zoo,entertainment.aquarium,natural,heritage&filter=circle:${lon},${lat},${radius}&limit=20&apiKey=${API_KEY}`
    console.log("[v0] Places URL:", placesUrl)

    const placesResponse = await fetch(placesUrl)
    console.log("[v0] Places response status:", placesResponse.status)

    if (!placesResponse.ok) {
      const errorText = await placesResponse.text()
      console.log("[v0] Places error response:", errorText)
      throw new Error(`Failed to fetch tourist places: ${placesResponse.status} - ${errorText}`)
    }

    const placesData = await placesResponse.json()
    console.log("[v0] Places data received, features count:", placesData.features?.length || 0)

    const places =
      placesData.features
        ?.map((place: GeoapifyPlace) => {
          let placeName = place.properties.name || ""

          if (!placeName || placeName === "Unnamed Place") {
            // Check raw data for alternative names
            const rawData = (place.properties as any).datasource?.raw
            if (rawData) {
              placeName = rawData.name || rawData.alt_name || rawData.official_name || rawData.loc_name || ""
            }

            if (!placeName) {
              // Try different address fields in order of preference
              const addressSources = [
                place.properties.formatted,
                place.properties.address_line1,
                place.properties.address_line2,
                place.properties.city,
              ].filter(Boolean)

              for (const address of addressSources) {
                if (address && address.trim()) {
                  // Extract the first meaningful part before comma, semicolon, or dash
                  const firstPart = address.split(/[,;-]/)[0].trim()
                  // Only use if meaningful (not just numbers, coordinates, or very short)
                  if (
                    firstPart &&
                    firstPart.length > 2 &&
                    !/^\d+$/.test(firstPart) &&
                    !/^\d+\.\d+$/.test(firstPart) && // Not coordinates
                    !firstPart.match(/^[A-Z]{1,3}\s*\d+/) && // Not road codes like "NH 44"
                    firstPart.length < 50
                  ) {
                    // Not too long
                    placeName = firstPart
                    console.log(`[v0] Extracted name from address: "${firstPart}" from "${address}"`)
                    break
                  }
                }
              }
            }

            // If still no name, create a simple descriptive name based on category
            if (!placeName) {
              const categories = place.properties.categories || []
              const primaryCategory = categories[0] || ""

              if (primaryCategory.includes("tourism.attraction")) {
                placeName = "Tourist Attraction"
              } else if (primaryCategory.includes("tourism.sights")) {
                placeName = "Tourist Sight"
              } else if (primaryCategory.includes("entertainment.museum")) {
                placeName = "Museum"
              } else if (primaryCategory.includes("natural.water")) {
                placeName = "Water Feature"
              } else if (primaryCategory.includes("natural")) {
                placeName = "Natural Area"
              } else if (primaryCategory.includes("heritage")) {
                placeName = "Heritage Site"
              } else {
                placeName = "Point of Interest"
              }
            }
          }

          return {
            name: placeName,
            categories: place.properties.categories || [],
            address:
              place.properties.formatted ||
              place.properties.address_line1 ||
              `${place.properties.city || ""}, ${place.properties.country || ""}`.trim().replace(/^,\s*/, ""),
            lat: place.properties.lat,
            lon: place.properties.lon,
          }
        })
        .filter((place) => place.name && place.name.trim().length > 0) || []

    console.log("[v0] Returning", places.length, "places")
    console.log("[v0] Sample place data:", places[0])
    return NextResponse.json({
      success: true,
      location: { lat, lon, name: normalizedPlaceName },
      places: places,
    })
  } catch (error) {
    console.error("[v0] Error in API route:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch tourist places",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
