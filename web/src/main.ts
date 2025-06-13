import './style.css'
import * as L from 'leaflet'
import init, { buffer_geometry, validate_geojson, get_geometry_info, wkt_to_geojson, geojson_to_wkt } from '../pkg/geo_buffer_wasm.js'

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

type DrawingTool = 'none' | 'point' | 'line' | 'polygon'
type InputFormat = 'geojson' | 'wkt'

class GeoBufferDebugger {
  private map!: L.Map
  private originalLayer: L.GeoJSON | null = null
  private bufferedLayer: L.GeoJSON | null = null
  private wasmReady = false
  private currentTool: DrawingTool = 'none'
  private currentLineCoords: number[][] = []
  private currentPolygonCoords: number[][] = []
  private drawnFeatures: any[] = []
  private tempLayer: L.LayerGroup | null = null
  private tempMarkers: L.CircleMarker[] = []
  private currentFormat: InputFormat = 'geojson'
  private isConverting = false

  constructor() {
    this.initializeWasm()
    this.initializeMap()
    this.setupEventListeners()
    this.setupDrawingTools()
    this.setupFormatToggle()
    this.setupUrlSharing()
    this.loadFromUrlOrDefault()
  }

  private async initializeWasm() {
    try {
      await init()
      this.wasmReady = true
      console.log('WASM module loaded successfully')
      // Check for URL parameters and load geometry once WASM is ready
      const urlParams = new URLSearchParams(window.location.search)
      const encodedInput = urlParams.get('input')
      
      if (encodedInput) {
        this.loadFromUrl(encodedInput)
      }
      
      // Trigger validation and buffer for current input
      const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
      if (geojsonInput && geojsonInput.value) {
        this.validateCurrentInput()
        this.applyBufferIfReady()
        this.fitMapToFeatures()
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

  private setupDrawingTools() {
    const pointBtn = document.getElementById('tool-point') as HTMLButtonElement
    const lineBtn = document.getElementById('tool-line') as HTMLButtonElement
    const polygonBtn = document.getElementById('tool-polygon') as HTMLButtonElement
    const clearBtn = document.getElementById('tool-clear') as HTMLButtonElement
    pointBtn.addEventListener('click', () => this.setDrawingTool('point'))
    lineBtn.addEventListener('click', () => this.setDrawingTool('line'))
    polygonBtn.addEventListener('click', () => this.setDrawingTool('polygon'))
    clearBtn.addEventListener('click', () => this.clearDrawnFeatures())

    // Add map click handler for drawing
    this.map.on('click', (e: L.LeafletMouseEvent) => this.handleMapClick(e))

    // Add fit bounds button handler
    const fitBoundsBtn = document.getElementById('fit-bounds-btn') as HTMLButtonElement
    fitBoundsBtn.addEventListener('click', () => this.fitMapToFeatures())
  }

  private setDrawingTool(tool: DrawingTool) {
    // Reset any in-progress drawing
    this.clearTempDrawing()
    this.currentLineCoords = []
    this.currentPolygonCoords = []
    this.currentTool = tool
    this.updateDrawingStatus()
    this.updateToolButtons()
  }

  private updateToolButtons() {
    const buttons = document.querySelectorAll('.tool-btn:not(.clear-btn)')
    buttons.forEach(btn => btn.classList.remove('active'))
    
    if (this.currentTool !== 'none') {
      const activeBtn = document.getElementById(`tool-${this.currentTool}`)
      if (activeBtn) activeBtn.classList.add('active')
    }
  }

  private updateDrawingStatus() {
    const statusDiv = document.getElementById('drawing-status') as HTMLDivElement
    
    switch (this.currentTool) {
      case 'point':
        statusDiv.textContent = 'Click on the map to add a point'
        break
      case 'line':
        if (this.currentLineCoords.length === 0) {
          statusDiv.textContent = 'Click to start drawing a line. Click last point again to finish.'
        } else {
          statusDiv.textContent = `Line: ${this.currentLineCoords.length} points. Click last point again to finish.`
        }
        break
      case 'polygon':
        if (this.currentPolygonCoords.length === 0) {
          statusDiv.textContent = 'Click to start drawing a polygon. Click first point again to close.'
        } else {
          statusDiv.textContent = `Polygon: ${this.currentPolygonCoords.length} points. Click first point again to close.`
        }
        break
      default:
        statusDiv.textContent = 'Select a drawing tool to start'
    }
  }

  private handleMapClick(e: L.LeafletMouseEvent) {
    if (this.currentTool === 'none') return

    const { lat, lng } = e.latlng
    const coords = [lng, lat] // GeoJSON uses [lng, lat]

    switch (this.currentTool) {
      case 'point':
        this.addPoint(coords)
        break
      case 'line':
        this.addLinePoint(coords)
        break
      case 'polygon':
        this.addPolygonPoint(coords)
        break
    }
  }

  private addPoint(coords: number[]) {
    const feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: coords
      }
    }
    
    this.drawnFeatures.push(feature)
    this.updateGeoJSONInput()
    this.setDrawingTool('none')
  }

  private addLinePoint(coords: number[]) {
    // Check if clicking on the last point to finish
    if (this.currentLineCoords.length > 0) {
      const lastPoint = this.currentLineCoords[this.currentLineCoords.length - 1]
      const distance = Math.sqrt(
        Math.pow(coords[0] - lastPoint[0], 2) + Math.pow(coords[1] - lastPoint[1], 2)
      )
      
      // If clicking very close to last point (within ~100m at zoom level), finish the line
      if (distance < 0.001) {
        if (this.currentLineCoords.length >= 2) {
          this.finishLine()
        }
        return
      }
    }

    this.currentLineCoords.push(coords)
    this.updateTempLineDrawing()
    this.updateDrawingStatus()
  }

  private addPolygonPoint(coords: number[]) {
    // Check if clicking on the first point to close polygon
    if (this.currentPolygonCoords.length >= 3) {
      const firstPoint = this.currentPolygonCoords[0]
      const distance = Math.sqrt(
        Math.pow(coords[0] - firstPoint[0], 2) + Math.pow(coords[1] - firstPoint[1], 2)
      )
      
      // If clicking very close to first point (within ~100m at zoom level), close the polygon
      if (distance < 0.001) {
        this.finishPolygon()
        return
      }
    }

    this.currentPolygonCoords.push(coords)
    this.updateTempPolygonDrawing()
    this.updateDrawingStatus()
  }

  private finishLine() {
    const feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [...this.currentLineCoords]
      }
    }
    
    this.drawnFeatures.push(feature)
    this.clearTempDrawing()
    this.currentLineCoords = []
    this.updateGeoJSONInput()
    this.setDrawingTool('none')
  }

  private finishPolygon() {
    // Close the polygon by adding the first point at the end
    const closedCoords = [...this.currentPolygonCoords, this.currentPolygonCoords[0]]
    
    const feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [closedCoords]
      }
    }
    
    this.drawnFeatures.push(feature)
    this.clearTempDrawing()
    this.currentPolygonCoords = []
    this.updateGeoJSONInput()
    this.setDrawingTool('none')
  }

  private updateGeoJSONInput() {
    const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
    
    if (this.drawnFeatures.length === 0) {
      geojsonInput.value = ''
    } else if (this.drawnFeatures.length === 1) {
      geojsonInput.value = JSON.stringify(this.drawnFeatures[0].geometry, null, 2)
    } else {
      const featureCollection = {
        type: 'FeatureCollection',
        features: this.drawnFeatures
      }
      geojsonInput.value = JSON.stringify(featureCollection, null, 2)
    }
    
    // Update WKT field if we're in WKT mode or need to keep it in sync
    this.convertToWkt(geojsonInput.value)
    
    this.validateCurrentInput()
    this.applyBufferIfReady()
  }

  private clearDrawnFeatures() {
    this.drawnFeatures = []
    this.currentLineCoords = []
    this.currentPolygonCoords = []
    this.clearTempDrawing()
    this.setDrawingTool('none')
    
    // Clear both input fields
    const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
    const wktInput = document.getElementById('wkt-input') as HTMLTextAreaElement
    geojsonInput.value = ''
    wktInput.value = ''
    
    // Clear the map layers
    this.clearOriginalGeometry()
    if (this.bufferedLayer) {
      this.map.removeLayer(this.bufferedLayer)
      this.bufferedLayer = null
    }
    
    // Clear both result textareas
    const geojsonResultTextarea = document.getElementById('result-geojson') as HTMLTextAreaElement
    const wktResultTextarea = document.getElementById('result-wkt') as HTMLTextAreaElement
    geojsonResultTextarea.value = ''
    wktResultTextarea.value = ''
    
    // Clear validation message
    const validationDiv = document.getElementById('format-validation')!
    validationDiv.style.display = 'none'
  }


  private initTempLayer() {
    if (!this.tempLayer) {
      this.tempLayer = L.layerGroup().addTo(this.map)
    }
  }

  private clearTempDrawing() {
    if (this.tempLayer) {
      this.tempLayer.clearLayers()
    }
    this.tempMarkers = []
  }

  private updateTempLineDrawing() {
    this.initTempLayer()
    this.clearTempDrawing()

    if (this.currentLineCoords.length === 0) return

    // Add markers for each point
    this.currentLineCoords.forEach((coord, index) => {
      const isLast = index === this.currentLineCoords.length - 1
      const marker = L.circleMarker([coord[1], coord[0]], {
        radius: isLast ? 8 : 5,
        color: isLast ? '#ff6b6b' : '#4ecdc4',
        fillColor: isLast ? '#ff6b6b' : '#4ecdc4',
        fillOpacity: 0.8,
        weight: 2
      })
      
      if (isLast) {
        marker.bindTooltip('Click here to finish line', { permanent: false })
      }
      
      this.tempMarkers.push(marker)
      this.tempLayer!.addLayer(marker)
    })

    // Draw the line if we have at least 2 points
    if (this.currentLineCoords.length >= 2) {
      const latLngs = this.currentLineCoords.map(coord => [coord[1], coord[0]] as [number, number])
      const polyline = L.polyline(latLngs, {
        color: '#4ecdc4',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 5'
      })
      this.tempLayer!.addLayer(polyline)
    }
  }

  private updateTempPolygonDrawing() {
    this.initTempLayer()
    this.clearTempDrawing()

    if (this.currentPolygonCoords.length === 0) return

    // Add markers for each point
    this.currentPolygonCoords.forEach((coord, index) => {
      const isFirst = index === 0
      const marker = L.circleMarker([coord[1], coord[0]], {
        radius: isFirst ? 8 : 5,
        color: isFirst ? '#ff6b6b' : '#4ecdc4',
        fillColor: isFirst ? '#ff6b6b' : '#4ecdc4',
        fillOpacity: 0.8,
        weight: 2
      })
      
      if (isFirst && this.currentPolygonCoords.length >= 3) {
        marker.bindTooltip('Click here to close polygon', { permanent: false })
      }
      
      this.tempMarkers.push(marker)
      this.tempLayer!.addLayer(marker)
    })

    // Draw the polygon outline if we have at least 2 points
    if (this.currentPolygonCoords.length >= 2) {
      const latLngs = this.currentPolygonCoords.map(coord => [coord[1], coord[0]] as [number, number])
      
      // If we have 3+ points, show a preview of the closed polygon
      if (this.currentPolygonCoords.length >= 3) {
        const closedLatLngs = [...latLngs, latLngs[0]]
        const polygon = L.polygon(closedLatLngs, {
          color: '#4ecdc4',
          weight: 3,
          opacity: 0.7,
          fillOpacity: 0.1,
          dashArray: '5, 5'
        })
        this.tempLayer!.addLayer(polygon)
      } else {
        // Just show a line for the first 2 points
        const polyline = L.polyline(latLngs, {
          color: '#4ecdc4',
          weight: 3,
          opacity: 0.7,
          dashArray: '5, 5'
        })
        this.tempLayer!.addLayer(polyline)
      }
    }
  }

  private applyBufferIfReady() {
    if (!this.wasmReady) {
      return
    }

    const distanceInput = document.getElementById('distance') as HTMLInputElement
    const lineCapSelect = document.getElementById('line-cap') as HTMLSelectElement
    const lineJoinSelect = document.getElementById('line-join') as HTMLSelectElement
    const miterLimitInput = document.getElementById('miter-limit') as HTMLInputElement

    // Only apply buffer if we have valid input
    const validationDiv = document.getElementById('format-validation')!
    if (!validationDiv.className.includes('valid')) {
      return
    }

    // Always use GeoJSON for buffer operations (convert from WKT if needed)
    const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
    const config: BufferConfig = {
      distance: parseFloat(distanceInput.value),
      line_cap: lineCapSelect.value,
      line_join: lineJoinSelect.value,
      miter_limit: lineJoinSelect.value === 'miter' ? parseFloat(miterLimitInput.value) : undefined
    }

    this.applyBuffer(geojsonInput.value, config)
  }

  private validateGeojsonInput(geojson: string) {
    const validationDiv = document.getElementById('format-validation')!
    
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
      validate_geojson(geojson.trim())
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
    const geojsonResultTextarea = document.getElementById('result-geojson') as HTMLTextAreaElement
    const wktResultTextarea = document.getElementById('result-wkt') as HTMLTextAreaElement
    
    // Always update GeoJSON output
    try {
      const formatted = JSON.stringify(JSON.parse(geojson), null, 2)
      geojsonResultTextarea.value = formatted
    } catch {
      geojsonResultTextarea.value = geojson
    }
    
    // Convert to WKT for WKT output
    if (this.wasmReady) {
      try {
        const wktResult = geojson_to_wkt(geojson.trim())
        wktResultTextarea.value = wktResult
      } catch (error) {
        wktResultTextarea.value = ''
      }
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

  private fitMapToFeatures() {
    const layers = []
    
    if (this.originalLayer) {
      layers.push(this.originalLayer)
    }
    
    if (this.bufferedLayer) {
      layers.push(this.bufferedLayer)
    }
    
    if (layers.length > 0) {
      const group = L.featureGroup(layers)
      this.map.fitBounds(group.getBounds(), { padding: [20, 20] })
    }
  }

  private setupFormatToggle() {
    const formatRadios = document.querySelectorAll('input[name="format"]') as NodeListOf<HTMLInputElement>
    const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
    const wktInput = document.getElementById('wkt-input') as HTMLTextAreaElement

    formatRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          const newFormat = radio.value as InputFormat
          this.switchFormat(newFormat)
        }
      })
    })

    // Set up input event listeners for both formats
    geojsonInput.addEventListener('input', () => {
      if (this.currentFormat === 'geojson' && !this.isConverting) {
        this.handleFormatInput('geojson', geojsonInput.value)
      }
    })

    wktInput.addEventListener('input', () => {
      if (this.currentFormat === 'wkt' && !this.isConverting) {
        this.handleFormatInput('wkt', wktInput.value)
      }
    })
  }

  private switchFormat(newFormat: InputFormat) {
    const geojsonInputContainer = document.getElementById('geojson-container') as HTMLElement
    const wktInputContainer = document.getElementById('wkt-container') as HTMLElement
    const geojsonOutputContainer = document.getElementById('geojson-output-container') as HTMLElement
    const wktOutputContainer = document.getElementById('wkt-output-container') as HTMLElement

    this.currentFormat = newFormat

    if (newFormat === 'geojson') {
      // Show GeoJSON input/output, hide WKT
      geojsonInputContainer.style.display = 'block'
      wktInputContainer.style.display = 'none'
      geojsonOutputContainer.style.display = 'block'
      wktOutputContainer.style.display = 'none'
    } else {
      // Show WKT input/output, hide GeoJSON
      geojsonInputContainer.style.display = 'none'
      wktInputContainer.style.display = 'block'
      geojsonOutputContainer.style.display = 'none'
      wktOutputContainer.style.display = 'block'
    }

    // Convert current content when switching formats
    this.convertBetweenFormats()
    this.convertCurrentOutput()
    this.validateCurrentInput()
  }

  private handleFormatInput(format: InputFormat, value: string) {
    if (format === 'geojson') {
      this.convertToWkt(value)
    } else {
      this.convertToGeoJson(value)
    }
    this.validateCurrentInput()
    this.applyBufferIfReady()
  }

  private convertBetweenFormats() {
    if (!this.wasmReady) return

    const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
    const wktInput = document.getElementById('wkt-input') as HTMLTextAreaElement

    if (this.currentFormat === 'wkt' && geojsonInput.value.trim()) {
      this.convertToWkt(geojsonInput.value)
    } else if (this.currentFormat === 'geojson' && wktInput.value.trim()) {
      this.convertToGeoJson(wktInput.value)
    }
  }

  private convertToWkt(geojsonValue: string) {
    if (!this.wasmReady || !geojsonValue.trim()) {
      this.setWktInput('')
      return
    }

    try {
      this.isConverting = true
      const wktResult = geojson_to_wkt(geojsonValue.trim())
      this.setWktInput(wktResult)
    } catch (error) {
      this.setWktInput('')
    } finally {
      this.isConverting = false
    }
  }

  private convertToGeoJson(wktValue: string) {
    if (!this.wasmReady || !wktValue.trim()) {
      this.setGeoJsonInput('')
      return
    }

    try {
      this.isConverting = true
      const geojsonResult = wkt_to_geojson(wktValue.trim())
      this.setGeoJsonInput(geojsonResult)
    } catch (error) {
      this.setGeoJsonInput('')
    } finally {
      this.isConverting = false
    }
  }

  private setGeoJsonInput(value: string) {
    const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
    geojsonInput.value = value
  }

  private setWktInput(value: string) {
    const wktInput = document.getElementById('wkt-input') as HTMLTextAreaElement
    wktInput.value = value
  }

  private validateCurrentInput() {
    const currentInput = this.getCurrentInputValue()
    if (this.currentFormat === 'geojson') {
      this.validateGeojsonInput(currentInput)
    } else {
      this.validateWktInput(currentInput)
    }
  }

  private getCurrentInputValue(): string {
    if (this.currentFormat === 'geojson') {
      const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
      return geojsonInput.value
    } else {
      const wktInput = document.getElementById('wkt-input') as HTMLTextAreaElement
      return wktInput.value
    }
  }

  private validateWktInput(wkt: string) {
    const validationDiv = document.getElementById('format-validation')!
    
    if (!wkt.trim()) {
      validationDiv.style.display = 'none'
      return
    }

    if (!this.wasmReady) {
      validationDiv.textContent = 'WASM module loading...'
      validationDiv.className = 'validation-message invalid'
      return
    }

    try {
      const geojsonResult = wkt_to_geojson(wkt.trim())
      const info = get_geometry_info(geojsonResult)
      validationDiv.textContent = `✓ Valid WKT - ${info}`
      validationDiv.className = 'validation-message valid'
      this.displayOriginalGeometry(geojsonResult)
    } catch (error) {
      validationDiv.textContent = `✗ ${error}`
      validationDiv.className = 'validation-message invalid'
      this.clearOriginalGeometry()
    }
  }

  private convertCurrentOutput() {
    // Get current GeoJSON output and ensure WKT output is also populated
    const geojsonResultTextarea = document.getElementById('result-geojson') as HTMLTextAreaElement
    if (geojsonResultTextarea.value.trim()) {
      this.displayResult(geojsonResultTextarea.value)
    }
  }

  private setupUrlSharing() {
    const copyUrlGeojsonBtn = document.getElementById('copy-url-geojson') as HTMLButtonElement
    const copyUrlWktBtn = document.getElementById('copy-url-wkt') as HTMLButtonElement

    copyUrlGeojsonBtn.addEventListener('click', () => this.copyShareableUrl())
    copyUrlWktBtn.addEventListener('click', () => this.copyShareableUrl())
  }

  private copyShareableUrl() {
    const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
    const geojsonValue = geojsonInput.value.trim()

    if (!geojsonValue) {
      alert('No geometry to share. Please add some input geometry first.')
      return
    }

    if (!this.wasmReady) {
      alert('WASM module not ready yet. Please wait a moment and try again.')
      return
    }

    try {
      // Convert GeoJSON to WKT for more compact encoding
      const wktValue = geojson_to_wkt(geojsonValue)
      
      // Encode WKT as base64 (much smaller than GeoJSON)
      const encoded = btoa(encodeURIComponent(wktValue))
      
      // Create URL with encoded parameter
      const url = new URL(window.location.href)
      url.searchParams.set('input', encoded)
      
      const urlString = url.toString()
      const urlSize = new Blob([urlString]).size
      
      // Check if URL is too large (32KB limit)
      if (urlSize > 32 * 1024) {
        const sizeKB = Math.round(urlSize / 1024 * 10) / 10
        const confirmed = confirm(
          `⚠️ Warning: This URL is ${sizeKB}KB, which exceeds the recommended 32KB limit.\n\n` +
          `Large URLs may not work properly in some browsers or when shared via certain platforms.\n\n` +
          `Do you want to copy it anyway?`
        )
        
        if (!confirmed) {
          return
        }
      }
      
      // Copy to clipboard
      navigator.clipboard.writeText(urlString).then(() => {
        // Temporarily change button text to show success
        const btn = this.currentFormat === 'geojson' 
          ? document.getElementById('copy-url-geojson') as HTMLButtonElement
          : document.getElementById('copy-url-wkt') as HTMLButtonElement
        
        const originalText = btn.textContent
        btn.textContent = '✓ Copied!'
        btn.style.background = '#218838'
        
        setTimeout(() => {
          btn.textContent = originalText
          btn.style.background = ''
        }, 2000)
      }).catch(() => {
        alert('Failed to copy URL to clipboard')
      })
    } catch (error) {
      alert('Failed to create shareable URL: ' + error)
    }
  }

  private loadFromUrlOrDefault() {
    // This is only called when WASM isn't ready yet
    // The actual URL loading is handled in initializeWasm once WASM is ready
    const urlParams = new URLSearchParams(window.location.search)
    const encodedInput = urlParams.get('input')

    if (!encodedInput) {
      // Only load default if there's no URL parameter
      this.loadDefaultGeoJSON()
    }
    // If there is a URL parameter, wait for WASM to be ready
  }

  private loadFromUrl(encodedInput: string) {
    if (!this.wasmReady) {
      // If WASM isn't ready yet, try again after a short delay
      setTimeout(() => this.loadFromUrl(encodedInput), 100)
      return
    }

    try {
      // Decode from base64 - this should be WKT now
      const decodedWkt = decodeURIComponent(atob(encodedInput))
      
      // Convert WKT to GeoJSON
      const geojsonValue = wkt_to_geojson(decodedWkt)
      
      // Set both input fields
      const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
      const wktInput = document.getElementById('wkt-input') as HTMLTextAreaElement
      geojsonInput.value = geojsonValue
      wktInput.value = decodedWkt
      
      // Parse and load the features
      this.parseAndLoadFeatures(geojsonValue)
      
      console.log('Loaded geometry from URL (WKT format)')
    } catch (error) {
      console.error('Failed to load geometry from URL:', error)
      // Fall back to default if URL parameter is invalid
      this.loadDefaultGeoJSON()
    }
  }

  private loadDefaultGeoJSON() {
    const geojsonInput = document.getElementById('geojson-input') as HTMLTextAreaElement
    
    // Set initial example - features around Belize (keeping the existing default)
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

    this.parseAndLoadFeatures(geojsonInput.value)
    this.validateGeojsonInput(geojsonInput.value)
  }

  private parseAndLoadFeatures(geojsonValue: string) {
    try {
      const existingData = JSON.parse(geojsonValue)
      if (existingData.type === 'FeatureCollection') {
        this.drawnFeatures = [...existingData.features]
      } else if (existingData.type === 'Feature') {
        this.drawnFeatures = [existingData]
      } else {
        // It's a geometry, wrap it in a feature
        this.drawnFeatures = [{
          type: 'Feature',
          properties: {},
          geometry: existingData
        }]
      }
    } catch (error) {
      console.log('Could not parse GeoJSON, starting fresh')
      this.drawnFeatures = []
    }
  }

}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new GeoBufferDebugger()
})