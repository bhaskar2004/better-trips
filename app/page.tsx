"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Search, MapPin, Filter, X, Navigation } from "lucide-react"

interface Suggestion {
  name: string
  state: string
  country: string
  displayName: string
}

interface Place {
  name: string
  categories: string[]
  address: string
  lat?: number
  lon?: number
  priority: number
}

export default function Home() {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoadingSuggest, setIsLoadingSuggest] = useState(false)
  const [selected, setSelected] = useState<Suggestion | null>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [searchMode, setSearchMode] = useState<'nearby' | 'search'>('nearby')
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'priority' | 'distance'>('priority')
  const [showFilters, setShowFilters] = useState(false)

  const [debouncedQuery, setDebouncedQuery] = useState("")
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.error("Error getting location:", error)
          setUserLocation({ lat: 20.5937, lng: 78.9629 })
        }
      )
    } else {
      setUserLocation({ lat: 20.5937, lng: 78.9629 })
    }
  }, [])

  useEffect(() => {
    if (!userLocation) return
    let ignore = false
    const run = async () => {
      setIsLoadingPlaces(true)
      setError(null)
      try {
        const res = await fetch(`/api/nearby?lat=${userLocation.lat}&lon=${userLocation.lng}`)
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`)
        }
        const json = await res.json()
        if (!ignore) {
          setPlaces(json.places || [])
          setSearchMode('nearby')
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        if (!ignore) {
          setError(`Failed to load nearby places: ${msg}`)
        }
      } finally {
        if (!ignore) setIsLoadingPlaces(false)
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [userLocation])

  const distanceKm = (a: {lat:number, lng:number}, b: {lat:number, lng:number}) => {
    const toRad = (x: number) => (x * Math.PI) / 180
    const R = 6371
    const dLat = toRad(b.lat - a.lat)
    const dLon = toRad(b.lng - a.lng)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2
    return 2 * R * Math.asin(Math.sqrt(h))
  }

  useEffect(() => {
    let ignore = false
    const run = async () => {
      setError(null)
      if (debouncedQuery.length < 2) {
        setSuggestions([])
        return
      }
      setIsLoadingSuggest(true)
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(debouncedQuery)}`)
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`)
        }
        const json = await res.json()
        if (!ignore) setSuggestions(json.suggestions || [])
      } catch (e: unknown) {
        if (!ignore) {
          console.error("Autocomplete error:", e)
          setSuggestions([])
        }
      } finally {
        if (!ignore) setIsLoadingSuggest(false)
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [debouncedQuery])

  const onSearchPlaces = async (placeText?: string) => {
    const searchText = placeText || selected?.name || query
    if (!searchText) return
    
    setSearchMode('search')
    setIsLoadingPlaces(true)
    setError(null)
    setPlaces([])
    setSuggestions([])
    
    try {
      const res = await fetch(`/api/tourist-places?place=${encodeURIComponent(searchText)}`)
      if (!res.ok) {
        throw new Error(`API returned ${res.status}`)
      }
      const json = await res.json()
      setPlaces(json.places || [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setError(`Failed to search places: ${msg}`)
    } finally {
      setIsLoadingPlaces(false)
    }
  }

  const filteredAndSortedPlaces = useMemo(() => {
    return [...places]
      .filter(p => selectedCategories.length === 0 || (p.categories||[]).some(c => selectedCategories.includes(c)))
      .sort((a, b) => {
        if (sortBy === 'priority') return b.priority - a.priority
        if (!userLocation) return 0
        const da = a.lat && a.lon ? distanceKm(userLocation, {lat:a.lat, lng:a.lon}) : Infinity
        const db = b.lat && b.lon ? distanceKm(userLocation, {lat:b.lat, lng:b.lon}) : Infinity
        return da - db
      })
  }, [places, selectedCategories, sortBy, userLocation])

  const categoryLabels = {
    'tourism.attraction': 'Attractions',
    'tourism.sights': 'Sights',
    'entertainment.museum': 'Museums',
    'natural': 'Nature',
    'heritage': 'Heritage'
  }

  return (
    <div className="min-h-screen w-full bg-white">
      {/* Hero Header */}
      <div className="w-full bg-black text-white py-16 px-6 border-b-4 border-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">Explore India</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4">BetterTrips</h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Discover amazing places near you and create unforgettable memories
          </p>
        </div>
      </div>

      {/* Search Section */}
      <div className="max-w-4xl mx-auto px-6 -mt-8">
        <div className="bg-white rounded-2xl shadow-2xl p-6 relative border-4 border-black">
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSearchPlaces()
                  }
                }}
                placeholder="Search destinations, cities, or landmarks..."
                className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-300 outline-none focus:border-black transition-colors text-base"
              />
            </div>
            <button
              onClick={() => onSearchPlaces()}
              disabled={!query.trim()}
              className="px-8 py-4 bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-lg hover:shadow-xl"
            >
              Search
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-4 border-2 rounded-xl transition-colors ${showFilters ? 'bg-black text-white border-black' : 'border-gray-300 hover:bg-gray-100'}`}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {isLoadingSuggest && query.length >= 2 && (
            <div className="text-sm text-gray-500 px-2 mt-3 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Loading suggestions...
            </div>
          )}
          
          {!isLoadingSuggest && suggestions.length > 0 && (
            <ul className="absolute top-full left-6 right-6 mt-2 border-4 border-black rounded-xl bg-white shadow-2xl z-10 max-h-80 overflow-y-auto">
              {suggestions.map((s, i) => (
                <li key={i} className={i > 0 ? "border-t-2 border-gray-200" : ""}>
                  <button
                    className="w-full text-left px-5 py-4 hover:bg-gray-100 transition-colors flex items-center gap-3"
                    onClick={() => {
                      setSelected(s)
                      setQuery(s.displayName || s.name)
                      setSuggestions([])
                      onSearchPlaces(s.name)
                    }}
                  >
                    <MapPin className="w-4 h-4 text-black flex-shrink-0" />
                    <div>
                      <div className="font-medium text-gray-900">{s.displayName || s.name}</div>
                      {s.country && <div className="text-xs text-gray-500">{s.country}</div>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t-2 border-gray-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Filters</h3>
                <button
                  onClick={() => {
                    setSelectedCategories([])
                    setShowFilters(false)
                  }}
                  className="text-sm text-black hover:text-gray-700 flex items-center gap-1 font-medium"
                >
                  <X className="w-4 h-4" />
                  Clear all
                </button>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Categories</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(categoryLabels).map(([cat, label]) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategories(prev => 
                        prev.includes(cat) ? prev.filter(c => c!==cat) : [...prev, cat]
                      )}
                      className={`px-4 py-2 rounded-lg font-medium transition-all border-2 ${
                        selectedCategories.includes(cat) 
                          ? 'bg-black text-white border-black shadow-md' 
                          : 'bg-white text-black border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Sort by</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSortBy('priority')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border-2 ${
                      sortBy === 'priority'
                        ? 'bg-black text-white border-black shadow-md'
                        : 'bg-white text-black border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    Most Popular
                  </button>
                  <button
                    onClick={() => setSortBy('distance')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border-2 ${
                      sortBy === 'distance'
                        ? 'bg-black text-white border-black shadow-md'
                        : 'bg-white text-black border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    Nearest First
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-4xl mx-auto px-6 mt-6">
          <div className="bg-white border-4 border-black rounded-xl px-5 py-4 text-black flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1 font-medium">{error}</div>
          </div>
        </div>
      )}

      {/* Results Section */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {searchMode === 'nearby' ? 'Nearby Highlights' : `Results${query ? ` for "${query}"` : ''}`}
          </h2>
          <div className="text-sm text-gray-500 font-medium">
            {!isLoadingPlaces && filteredAndSortedPlaces.length > 0 && (
              <span>{filteredAndSortedPlaces.length} place{filteredAndSortedPlaces.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        
        {isLoadingPlaces && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({length:6}).map((_,i)=>(
              <div key={i} className="rounded-2xl border-2 border-gray-300 p-6 bg-white animate-pulse">
                <div className="h-5 w-2/3 bg-gray-200 rounded" />
                <div className="h-4 w-1/2 bg-gray-200 rounded mt-3" />
                <div className="h-10 w-28 bg-gray-200 rounded mt-4" />
              </div>
            ))}
          </div>
        )}
        
        {!isLoadingPlaces && places.length === 0 && !error && (
          <div className="rounded-2xl border-4 border-black p-12 bg-white text-center">
            <div className="text-6xl mb-4">🗺️</div>
            <div className="text-lg text-gray-600 font-medium">
              {searchMode === 'search' ? 'No places found. Try a different search.' : 'No places found nearby.'}
            </div>
          </div>
        )}
        
        {!isLoadingPlaces && filteredAndSortedPlaces.length === 0 && places.length > 0 && (
          <div className="rounded-2xl border-4 border-black p-12 bg-white text-center">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-lg text-gray-600 font-medium">
              No places match the selected filters.
            </div>
            <button
              onClick={() => setSelectedCategories([])}
              className="mt-4 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium"
            >
              Clear Filters
            </button>
          </div>
        )}
        
        {!isLoadingPlaces && filteredAndSortedPlaces.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAndSortedPlaces.map((p, idx) => (
              <div 
                key={idx} 
                className="group rounded-2xl border-2 border-gray-300 p-6 bg-white hover:border-black hover:shadow-2xl transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-black transition-colors">
                      {p.name}
                    </h3>
                    <div className="flex items-start gap-2 mt-2">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-600">{p.address}</p>
                    </div>
                  </div>
                  {searchMode === 'search' && userLocation && p.lat && p.lon && (
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-black text-sm font-bold whitespace-nowrap border-2 border-gray-300">
                      <Navigation className="w-3.5 h-3.5" />
                      {distanceKm(userLocation, {lat:p.lat, lng:p.lon}).toFixed(1)} km
                    </div>
                  )}
                </div>
                
                {p.categories && p.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {p.categories.slice(0,3).map((c) => (
                      <span 
                        key={c} 
                        className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-800 border-2 border-gray-300 font-medium"
                      >
                        {c.split('.').slice(-1)[0]}
                      </span>
                    ))}
                  </div>
                )}
                
                {p.lat && p.lon && (
                  <a
                    href={`https://www.google.com/maps/?q=${encodeURIComponent(p.name)}&ll=${p.lat},${p.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-all font-medium shadow-lg hover:shadow-xl"
                  >
                    <Navigation className="w-4 h-4" />
                    Get Directions
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}