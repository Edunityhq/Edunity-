// Quick script to verify all states are loaded
const fs = require('fs')

const content = fs.readFileSync('./data/locations.ts', 'utf-8')

// Extract all state values
const states = []
const lines = content.split('\n')
lines.forEach(line => {
  const match = line.match(/state: '([^']+)'/)
  if (match) {
    states.push(match[1])
  }
})

const uniqueStates = [...new Set(states)]
console.log(`Total unique states: ${uniqueStates.length}`)
console.log('States:', uniqueStates.sort().join(', '))
