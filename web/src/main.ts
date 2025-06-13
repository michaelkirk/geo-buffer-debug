import './style.css'
import * as L from 'leaflet'
import init, { buffer_geometry, validate_geojson, get_geometry_info } from '../pkg/geo_buffer_wasm.js'

interface BufferConfig {
  distance: number
  line_cap: string
  line_join: string
  miter_limit?: number
}

interface BufferResult {
  geojson: string
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
    const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
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

    // Validate GeoJSON input on change
    geojsonInput.addEventListener('input', () => {
      this.validateGeojsonInput(geojsonInput.value)
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

      this.applyBuffer(geojsonInput.value, config)
    })

    // Set initial example
    geojsonInput.value = JSON.stringify({
      "type": "Polygon",
      "coordinates": [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]
    }, null, 2)
    this.validateGeojsonInput(geojsonInput.value)
  }

  private validateGeojsonInput(geojson: string) {
    const validationDiv = document.getElementById('geojson-validation')!
    
    if (!geojson.trim()) {
      validationDiv.style.display = 'none'
      return
    }

    if (!this.wasmReady) {
      validationDiv.textContent = 'WASM module loading...'
      validationDiv.className = 'validation-message invalid'
      return
    }

    try {
      const result = validate_geojson(geojson.trim())
      const info = get_geometry_info(geojson.trim())
      validationDiv.textContent = `✓ Valid GeoJSON - ${info}`
      validationDiv.className = 'validation-message valid'
      this.displayOriginalGeometry(geojson.trim())
    } catch (error) {
      validationDiv.textContent = `✗ ${error}`
      validationDiv.className = 'validation-message invalid'
      this.clearOriginalGeometry()
    }
  }

  private applyBuffer(geojson: string, config: BufferConfig) {
    try {
      const configJson = JSON.stringify(config)
      const resultJson = buffer_geometry(geojson.trim(), configJson)
      const result: BufferResult = JSON.parse(resultJson)

      if (result.error) {
        this.showError(result.error)
        return
      }

      this.displayResult(result.geojson)
      this.displayBufferedGeometry(result.geojson)
      this.hideError()

    } catch (error) {
      this.showError(`Buffer operation failed: ${error}`)
    }
  }

  private displayOriginalGeometry(geojson: string) {
    console.log('Displaying original geometry:', geojson);
    try {
      const geojsonObj = JSON.parse(geojson)
      
      if (this.originalLayer) {
        this.map.removeLayer(this.originalLayer)
      }

      this.originalLayer = L.geoJSON(geojsonObj, {
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

  private displayBufferedGeometry(geojson: string) {
    try {
      const geojsonObj = JSON.parse(geojson)
      
      if (this.bufferedLayer) {
        this.map.removeLayer(this.bufferedLayer)
      }

      this.bufferedLayer = L.geoJSON(geojsonObj, {
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
    console.log('Clearing original geometry');
    if (this.originalLayer) {
      this.map.removeLayer(this.originalLayer)
      this.originalLayer = null
    }
  }

  private displayResult(geojson: string) {
    const resultTextarea = document.getElementById('result-geojson') as HTMLTextAreaElement
    try {
      const formatted = JSON.stringify(JSON.parse(geojson), null, 2)
      resultTextarea.value = formatted
    } catch {
      resultTextarea.value = geojson
    }
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

}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new GeoBufferDebugger()
})