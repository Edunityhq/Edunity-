const fs = require('fs')

// Read CSV file
const content = fs.readFileSync('c:\\Users\\HP\\Downloads\\archive\\State LGA and Areas.csv', 'utf-8')

// Simple CSV parser
const lines = content.split('\n')
const records = []

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim()
  if (!line) continue

  // Parse CSV line (simple split by comma, handling quoted values)
  const parts = []
  let current = ''
  let inQuotes = false

  for (let j = 0; j < line.length; j++) {
    const char = line[j]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current.trim())

  if (parts.length === 3) {
    records.push({
      state: parts[0],
      lga: parts[1],
      area: parts[2],
    })
  }
}

// Generate TypeScript
let ts = `export interface LocationData {
  state: string
  lga: string
  area: string
}

// Complete location data for Nigeria - All 36 states + FCT with all LGAs and Areas
export const LOCATIONS: LocationData[] = [
`

records.forEach((record) => {
  // Escape single quotes by replacing them with escaped quotes
  const state = record.state.replace(/'/g, "\\'")
  const lga = record.lga.replace(/'/g, "\\'")
  const area = record.area.replace(/'/g, "\\'")
  ts += `  { state: '${state}', lga: '${lga}', area: '${area}' },\n`
})

ts += `]

export function getStates(): string[] {
  return [...new Set(LOCATIONS.map((loc) => loc.state))].sort()
}

export function getLgasByState(state: string): string[] {
  return [...new Set(LOCATIONS.filter((loc) => loc.state === state).map((loc) => loc.lga))].sort()
}

export function getAreasByStateLga(state: string, lga: string): string[] {
  return [...new Set(LOCATIONS.filter((loc) => loc.state === state && loc.lga === lga).map((loc) => loc.area))].sort()
}
`

fs.writeFileSync('c:\\Users\\HP\\Downloads\\edunity-ui\\data\\locations.ts', ts)
console.log(`Conversion complete! locations.ts updated with ${records.length} location records.`)
