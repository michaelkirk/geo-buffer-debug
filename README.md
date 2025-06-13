# Geo Buffer Debug Tool

⚠️ This debug tool is largely AI generated slop, consumer beware.

An interactive browser-based debugging tool for the geo crate's [new buffer trait implementation](https://github.com/georust/geo/tree/mkirk/geo-buffer). This tool allows you to:

- Input geometries in WKT (Well-Known Text) format
- Configure buffer parameters (distance, line caps, line joins)
- Visualize original and buffered geometries on an interactive map
- Debug buffer operations in real-time

## Project Structure

```
geo-buffer-debug/
├── wasm/           # Rust WASM bindings
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs
├── web/            # TypeScript frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.ts
│       └── style.css
└── README.md
```

## Building and Running

### Prerequisites

- Rust with wasm-pack installed
- Node.js and npm

### Build Steps

1. **Build the WASM module:**
   ```bash
   cd wasm
   wasm-pack build --target web --out-dir ../web/pkg
   ```

2. **Install frontend dependencies:**
   ```bash
   cd web
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser to:**
   ```
   http://localhost:5173
   ```

### Alternative: One-command build

From the `web` directory:
```bash
npm run build-wasm && npm run dev
```

## Features

### Supported Geometry Types

- Point
- Line  
- LineString
- Polygon
- MultiPoint
- MultiLineString
- MultiPolygon
- GeometryCollection
- Rect
- Triangle

### Buffer Configuration Options

- **Distance**: Positive values create outward buffers, negative values create inward buffers (for polygons)
- **Line Cap**: Controls how line ends are capped
  - Round: Rounded caps (default)
  - Square: Square caps extending beyond the line
  - Butt: Flat caps at the line ends
- **Line Join**: Controls how line segments meet at vertices
  - Round: Rounded joins (default)
  - Miter: Sharp pointed joins with configurable miter limit
  - Bevel: Flat diagonal joins

### Map Visualization

- Original geometry displayed in red
- Buffered geometry displayed in blue
- Interactive Leaflet map with OpenStreetMap tiles
- Auto-zoom to fit geometries

## Example WKT Geometries

Try these examples in the tool:

```wkt
# Simple polygon
POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))

# LineString
LINESTRING(0 0, 1 1, 2 0, 3 1)

# Point
POINT(1.5 1.5)

# MultiLineString
MULTILINESTRING((0 0, 1 0), (2 0, 3 0))

# Complex polygon with hole
POLYGON((0 0, 4 0, 4 4, 0 4, 0 0), (1 1, 3 1, 3 3, 1 3, 1 1))
```

## Technical Details

The tool uses:

- **Rust/WASM**: geo crate compiled to WebAssembly for buffer operations
- **TypeScript**: Type-safe frontend logic
- **Vite**: Fast development server and build tool
- **Leaflet**: Interactive map visualization
- **CSS**: Custom styling for form controls and layout

The WASM module exposes three main functions:
- `buffer_geometry(wkt, config)`: Performs buffer operation
- `validate_wkt(wkt)`: Validates WKT input
- `get_geometry_info(wkt)`: Returns geometry type information

## Development

To modify the buffer operations, edit `wasm/src/lib.rs`. To update the UI, modify files in `web/src/`.

The project automatically handles:
- WKT parsing and validation
- Geometry type detection
- Buffer parameter serialization
- Error handling and display
- Map bounds adjustment
- Responsive layout
