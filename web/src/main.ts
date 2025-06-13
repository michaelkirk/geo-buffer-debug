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
      // Trigger validation once WASM is ready
      const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
      if (geojsonInput && geojsonInput.value) {
        this.validateGeojsonInput(geojsonInput.value)
        this.applyBufferIfReady()
      }
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
    const miterLimitGroup = document.querySelector('.miter-limit-group') as HTMLElement

    // Show/hide miter limit input based on line join selection
    lineJoinSelect.addEventListener('change', () => {
      if (lineJoinSelect.value === 'miter') {
        miterLimitGroup.style.display = 'block'
      } else {
        miterLimitGroup.style.display = 'none'
      }
      this.applyBufferIfReady()
    })

    // Validate GeoJSON input on change
    geojsonInput.addEventListener('input', () => {
      this.validateGeojsonInput(geojsonInput.value)
      this.applyBufferIfReady()
    })

    // Apply buffer when parameters change
    distanceInput.addEventListener('input', () => this.applyBufferIfReady())
    lineCapSelect.addEventListener('change', () => this.applyBufferIfReady())
    miterLimitInput.addEventListener('input', () => this.applyBufferIfReady())

    // Set initial example - features around Belize
    geojsonInput.value = JSON.stringify({
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "coordinates": [
          [
            [
              -89.22203731226631,
              15.919478319916351
            ],
            [
              -88.92244912542684,
              15.87814538651945
            ],
            [
              -88.83254963278378,
              15.981038154643826
            ],
            [
              -88.71695384308812,
              16.190830410784827
            ],
            [
              -88.54569623071036,
              16.231925523028025
            ],
            [
              -88.37871701285464,
              16.441466716930734
            ],
            [
              -88.29310624869152,
              16.728728081789896
            ],
            [
              -88.14751836436047,
              16.990943383827826
            ],
            [
              -88.28882234190722,
              17.101462723487074
            ],
            [
              -88.23742690543888,
              17.387698825293484
            ],
            [
              -87.94200213538677,
              17.889565133501492
            ],
            [
              -87.81783811559248,
              18.182686154519615
            ],
            [
              -88.02335098097838,
              18.170482569667286
            ],
            [
              -88.03191402082044,
              18.41439193731827
            ],
            [
              -88.23743087515625,
              18.42656011271997
            ],
            [
              -88.24599077717,
              18.471251062791865
            ],
            [
              -88.50288204264858,
              18.48743923291582
            ],
            [
              -88.85819613263257,
              17.901656852502285
            ],
            [
              -89.01227978174298,
              18.01562641821063
            ],
            [
              -89.16213371387813,
              17.96274503980726
            ],
            [
              -89.22203731226631,
              15.919478319916351
            ]
          ]
        ],
        "type": "Polygon"
      }
    },
    {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "coordinates": [
          [
            -91.436051662065,
            17.24850177813404
          ],
          [
            -91.32389161242773,
            17.1466377010765
          ],
          [
            -91.24254068569282,
            17.175232469529405
          ],
          [
            -91.2467623550109,
            17.093343084631144
          ],
          [
            -91.16542301650593,
            17.01147589087587
          ],
          [
            -91.12262683478133,
            16.96645435400508
          ],
          [
            -91.04561720279386,
            16.884608080324256
          ],
          [
            -90.99428573425823,
            16.876467915287023
          ],
          [
            -90.95149754389833,
            16.913363605703395
          ],
          [
            -90.9386631295941,
            16.864228563635393
          ],
          [
            -90.8873003186585,
            16.82737179414731
          ],
          [
            -90.78027737044178,
            16.778190771442667
          ],
          [
            -90.6903802654897,
            16.659282453066453
          ],
          [
            -90.64329189600558,
            16.597759297723485
          ],
          [
            -90.63044763048603,
            16.50748908670593
          ]
        ],
        "type": "LineString"
      }
    },
    {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "coordinates": [
          -90.28752310908116,
          16.66557517210579
        ],
        "type": "Point"
      }
    }
  ]
    }, null, 2)
    this.validateGeojsonInput(geojsonInput.value)
  }

  private applyBufferIfReady() {
    if (!this.wasmReady) {
      return
    }

    const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
    const distanceInput = document.getElementById('distance') as HTMLInputElement
    const lineCapSelect = document.getElementById('line-cap') as HTMLSelectElement
    const lineJoinSelect = document.getElementById('line-join') as HTMLSelectElement
    const miterLimitInput = document.getElementById('miter-limit') as HTMLInputElement

    // Only apply buffer if we have valid input
    const validationDiv = document.getElementById('geojson-validation')!
    if (!validationDiv.className.includes('valid')) {
      return
    }

    const config: BufferConfig = {
      distance: parseFloat(distanceInput.value),
      line_cap: lineCapSelect.value,
      line_join: lineJoinSelect.value,
      miter_limit: lineJoinSelect.value === 'miter' ? parseFloat(miterLimitInput.value) : undefined
    }

    this.applyBuffer(geojsonInput.value, config)
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

      // this.map.fitBounds(this.originalLayer.getBounds())
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
      // this.map.fitBounds(group.getBounds())
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