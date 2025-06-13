use wasm_bindgen::prelude::*;
use geo::{Buffer, Geometry};
use geo::algorithm::buffer::{BufferStyle, LineCap, LineJoin};
use wkt::{ToWkt, TryFromWkt};
use serde::{Deserialize, Serialize};

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Serialize, Deserialize)]
pub struct BufferConfig {
    pub distance: f64,
    pub line_cap: String,
    pub line_join: String,
    pub miter_limit: Option<f64>,
}

#[derive(Serialize, Deserialize)]
pub struct BufferResult {
    pub wkt: String,
    pub error: Option<String>,
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn buffer_geometry(wkt_input: &str, config_json: &str) -> String {
    let config: BufferConfig = match serde_json::from_str(config_json) {
        Ok(config) => config,
        Err(e) => {
            let result = BufferResult {
                wkt: String::new(),
                error: Some(format!("Invalid config JSON: {}", e)),
            };
            return serde_json::to_string(&result).unwrap();
        }
    };

    let geometry: Geometry<f64> = match Geometry::try_from_wkt_str(wkt_input) {
        Ok(geom) => geom,
        Err(e) => {
            let result = BufferResult {
                wkt: String::new(),
                error: Some(format!("Invalid WKT: {}", e)),
            };
            return serde_json::to_string(&result).unwrap();
        }
    };

    let line_cap = match config.line_cap.as_str() {
        "round" => LineCap::Round(0.2),
        "square" => LineCap::Square,
        "butt" => LineCap::Butt,
        _ => LineCap::Round(0.2),
    };

    let line_join = match config.line_join.as_str() {
        "round" => LineJoin::Round(0.2),
        "miter" => LineJoin::Miter(config.miter_limit.unwrap_or(1.0)),
        "bevel" => LineJoin::Bevel,
        _ => LineJoin::Round(0.2),
    };

    let style = BufferStyle::new(config.distance)
        .line_cap(line_cap)
        .line_join(line_join);

    let buffered = geometry.buffer_with_style(style);
    let result = BufferResult {
        wkt: buffered.wkt_string(),
        error: None,
    };
    serde_json::to_string(&result).unwrap()
}

#[wasm_bindgen]
pub fn validate_wkt(wkt_input: &str) -> String {
    match Geometry::<f64>::try_from_wkt_str(wkt_input) {
        Ok(_) => "valid".to_string(),
        Err(e) => format!("error: {}", e),
    }
}

#[wasm_bindgen]
pub fn get_geometry_info(wkt_input: &str) -> String {
    let geometry: Geometry<f64> = match Geometry::try_from_wkt_str(wkt_input) {
        Ok(geom) => geom,
        Err(e) => return format!("error: {}", e),
    };

    let info = match &geometry {
        Geometry::Point(_) => "Point",
        Geometry::Line(_) => "Line", 
        Geometry::LineString(_) => "LineString",
        Geometry::Polygon(_) => "Polygon",
        Geometry::MultiPoint(_) => "MultiPoint",
        Geometry::MultiLineString(_) => "MultiLineString",
        Geometry::MultiPolygon(_) => "MultiPolygon",
        Geometry::GeometryCollection(_) => "GeometryCollection",
        Geometry::Rect(_) => "Rect",
        Geometry::Triangle(_) => "Triangle",
    };

    format!("type: {}", info)
}