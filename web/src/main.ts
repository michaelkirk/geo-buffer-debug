import './style.css'
import * as L from 'leaflet'
import init, { buffer_geometry, validate_wkt, get_geometry_info } from '../pkg/geo_buffer_wasm.js'

interface BufferConfig {
  distance: number
  line_cap: string
  line_join: string
  miter_limit?: number
}

interface BufferResult {
  wkt: string
  error?: string
}

class GeoBufferDebugger {
  private map: L.Map
  private originalLayer: L.GeoJSON | null = null
  private bufferedLayer: L.GeoJSON | null = null
  private wasmReady = false

  constructor() {
    this.initializeWasm()
    this.initializeMap()
    this.setupEventListeners()
  }

  private async initializeWasm() {
    try {
      await init()
      this.wasmReady = true
      console.log('WASM module loaded successfully')
    } catch (error) {
      console.error('Failed to load WASM module:', error)
    }
  }

  private initializeMap() {
    this.map = L.map('map').setView([0, 0], 2)
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map)
  }

  private setupEventListeners() {
    const wktInput = document.getElementById('wkt-input') as HTMLTextAreaElement
    const distanceInput = document.getElementById('distance') as HTMLInputElement
    const lineCapSelect = document.getElementById('line-cap') as HTMLSelectElement
    const lineJoinSelect = document.getElementById('line-join') as HTMLSelectElement
    const miterLimitInput = document.getElementById('miter-limit') as HTMLInputElement
    const applyButton = document.getElementById('apply-buffer') as HTMLButtonElement
    const miterLimitGroup = document.querySelector('.miter-limit-group') as HTMLElement

    // Show/hide miter limit input based on line join selection
    lineJoinSelect.addEventListener('change', () => {
      if (lineJoinSelect.value === 'miter') {
        miterLimitGroup.style.display = 'block'
      } else {
        miterLimitGroup.style.display = 'none'
      }
    })

    // Validate WKT input on change
    wktInput.addEventListener('input', () => {
      this.validateWktInput(wktInput.value)
    })

    // Apply buffer operation
    applyButton.addEventListener('click', () => {
      if (!this.wasmReady) {
        this.showError('WASM module not loaded yet')
        return
      }

      const config: BufferConfig = {
        distance: parseFloat(distanceInput.value),
        line_cap: lineCapSelect.value,
        line_join: lineJoinSelect.value,
        miter_limit: lineJoinSelect.value === 'miter' ? parseFloat(miterLimitInput.value) : undefined
      }

      this.applyBuffer(wktInput.value, config)
    })

    // Set initial example
    wktInput.value = 'POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))'
    this.validateWktInput(wktInput.value)
  }

  private validateWktInput(wkt: string) {
    const validationDiv = document.getElementById('wkt-validation')!
    
    if (!wkt.trim()) {
      validationDiv.style.display = 'none'
      return
    }

    if (!this.wasmReady) {
      validationDiv.textContent = 'WASM module loading...'
      validationDiv.className = 'validation-message invalid'
      return
    }

    const result = validate_wkt(wkt.trim())
    
    if (result === 'valid') {
      const info = get_geometry_info(wkt.trim())
      validationDiv.textContent = `✓ Valid WKT - ${info}`
      validationDiv.className = 'validation-message valid'
      this.displayOriginalGeometry(wkt.trim())
    } else {
      validationDiv.textContent = `✗ ${result}`
      validationDiv.className = 'validation-message invalid'
      this.clearOriginalGeometry()
    }
  }

  private applyBuffer(wkt: string, config: BufferConfig) {
    try {
      const configJson = JSON.stringify(config)
      const resultJson = buffer_geometry(wkt.trim(), configJson)
      const result: BufferResult = JSON.parse(resultJson)

      if (result.error) {
        this.showError(result.error)
        return
      }

      this.displayResult(result.wkt)
      this.displayBufferedGeometry(result.wkt)
      this.hideError()

    } catch (error) {
      this.showError(`Buffer operation failed: ${error}`)
    }
  }

  private displayOriginalGeometry(wkt: string) {
    try {
      const geojson = this.wktToGeoJSON(wkt)
      
      if (this.originalLayer) {
        this.map.removeLayer(this.originalLayer)
      }

      this.originalLayer = L.geoJSON(geojson, {
        style: {
          color: '#e74c3c',
          weight: 2,
          fillOpacity: 0.3
        }
      }).addTo(this.map)

      this.map.fitBounds(this.originalLayer.getBounds())
    } catch (error) {
      console.error('Failed to display original geometry:', error)
    }
  }

  private displayBufferedGeometry(wkt: string) {
    try {
      const geojson = this.wktToGeoJSON(wkt)
      
      if (this.bufferedLayer) {
        this.map.removeLayer(this.bufferedLayer)
      }

      this.bufferedLayer = L.geoJSON(geojson, {
        style: {
          color: '#3498db',
          weight: 2,
          fillOpacity: 0.2
        }
      }).addTo(this.map)

      // Fit bounds to show both geometries
      const group = L.featureGroup([this.originalLayer!, this.bufferedLayer])
      this.map.fitBounds(group.getBounds())
    } catch (error) {
      console.error('Failed to display buffered geometry:', error)
    }
  }

  private clearOriginalGeometry() {
    if (this.originalLayer) {
      this.map.removeLayer(this.originalLayer)
      this.originalLayer = null
    }
  }

  private displayResult(wkt: string) {
    const resultTextarea = document.getElementById('result-wkt') as HTMLTextAreaElement
    resultTextarea.value = wkt
  }

  private showError(message: string) {
    const errorDiv = document.getElementById('error-message')!
    errorDiv.textContent = message
    errorDiv.style.display = 'block'
  }

  private hideError() {
    const errorDiv = document.getElementById('error-message')!
    errorDiv.style.display = 'none'
  }

  // Simple WKT to GeoJSON converter for basic geometries
  private wktToGeoJSON(wkt: string): any {
    const trimmed = wkt.trim().toUpperCase()
    
    if (trimmed.startsWith('POINT')) {
      const coords = this.extractCoordinates(trimmed, 'POINT')
      return {
        type: 'Point',
        coordinates: coords[0]
      }
    }
    
    if (trimmed.startsWith('LINESTRING')) {
      const coords = this.extractCoordinates(trimmed, 'LINESTRING')
      return {
        type: 'LineString',
        coordinates: coords
      }
    }
    
    if (trimmed.startsWith('POLYGON')) {
      const coords = this.extractPolygonCoordinates(trimmed)
      return {
        type: 'Polygon',
        coordinates: coords
      }
    }
    
    if (trimmed.startsWith('MULTIPOLYGON')) {
      const coords = this.extractMultiPolygonCoordinates(trimmed)
      return {
        type: 'MultiPolygon',
        coordinates: coords
      }
    }
    
    throw new Error(`Unsupported geometry type: ${trimmed.split('(')[0]}`)
  }

  private extractCoordinates(wkt: string, geomType: string): number[][] {
    const coordsString = wkt.substring(geomType.length).trim()
    const cleaned = coordsString.slice(1, -1) // Remove outer parentheses
    
    return cleaned.split(',').map(pair => {
      const [x, y] = pair.trim().split(/\s+/)
      return [parseFloat(x), parseFloat(y)]
    })
  }

  private extractPolygonCoordinates(wkt: string): number[][][] {
    const coordsString = wkt.substring('POLYGON'.length).trim()
    const rings = this.parseRings(coordsString)
    
    return rings.map(ring => {
      return ring.split(',').map(pair => {
        const [x, y] = pair.trim().split(/\s+/)
        return [parseFloat(x), parseFloat(y)]
      })
    })
  }

  private extractMultiPolygonCoordinates(wkt: string): number[][][][] {
    const coordsString = wkt.substring('MULTIPOLYGON'.length).trim()
    const polygons = this.parsePolygons(coordsString)
    
    return polygons.map(polygon => {
      const rings = this.parseRings(polygon)
      return rings.map(ring => {
        return ring.split(',').map(pair => {
          const [x, y] = pair.trim().split(/\s+/)
          return [parseFloat(x), parseFloat(y)]
        })
      })
    })
  }

  private parseRings(coordsString: string): string[] {
    let depth = 0
    let current = ''
    const rings: string[] = []
    
    for (let i = 1; i < coordsString.length - 1; i++) {
      const char = coordsString[i]
      
      if (char === '(') {
        depth++
        if (depth === 1) continue
      } else if (char === ')') {
        depth--
        if (depth === 0) {
          rings.push(current.trim())
          current = ''
          continue
        }
      }
      
      if (depth > 0) {
        current += char
      }
    }
    
    return rings
  }

  private parsePolygons(coordsString: string): string[] {
    let depth = 0
    let current = ''
    const polygons: string[] = []
    
    for (let i = 1; i < coordsString.length - 1; i++) {
      const char = coordsString[i]
      
      if (char === '(') {
        depth++
      } else if (char === ')') {
        depth--
      }
      
      current += char
      
      if (depth === 0 && char === ')') {
        polygons.push(current.trim())
        current = ''
        // Skip comma and whitespace
        while (i + 1 < coordsString.length - 1 && /[,\s]/.test(coordsString[i + 1])) {
          i++
        }
      }
    }
    
    return polygons
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new GeoBufferDebugger()
})