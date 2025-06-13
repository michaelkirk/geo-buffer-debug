use wasm_bindgen::prelude::*;
use geo::{Buffer, Geometry};
use geo::algorithm::buffer::{BufferStyle, LineCap, LineJoin};
use geojson::{GeoJson};
use serde::{Deserialize, Serialize};
use std::convert::TryFrom;
use std::str::FromStr;

pub type Error = String;
pub type Result<T> = std::result::Result<T, Error>;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
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
    pub geojson: String,
    pub error: Option<String>,
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn buffer_geometry(geojson_input: &str, config_json: &str) -> String {
    let config: BufferConfig = match serde_json::from_str(config_json) {
        Ok(config) => config,
        Err(e) => {
            let result = BufferResult {
                geojson: String::new(),
                error: Some(format!("Invalid config JSON: {}", e)),
            };
            return serde_json::to_string(&result).unwrap();
        }
    };

    let geojson: GeoJson = match geojson_input.parse() {
        Ok(geojson) => geojson,
        Err(e) => {
            let result = BufferResult {
                geojson: String::new(),
                error: Some(format!("Invalid GeoJSON: {}", e)),
            };
            return serde_json::to_string(&result).unwrap();
        }
    };

    let geometry: Geometry<f64> = match geojson.try_into() {
        Ok(geom) => geom,
        Err(e) => {
            let result = BufferResult {
                geojson: String::new(),
                error: Some(format!("Cannot convert GeoJSON to geometry: {}", e)),
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
    
    let buffered_geojson = match GeoJson::try_from(&buffered) {
        Ok(geojson) => geojson.to_string(),
        Err(e) => {
            let result = BufferResult {
                geojson: String::new(),
                error: Some(format!("Cannot convert buffered geometry to GeoJSON: {}", e)),
            };
            return serde_json::to_string(&result).unwrap();
        }
    };
    
    let result = BufferResult {
        geojson: buffered_geojson,
        error: None,
    };
    serde_json::to_string(&result).unwrap()
}

#[wasm_bindgen]
pub fn validate_geojson(geojson_input: &str) -> Result<()> {
    match GeoJson::from_str(geojson_input) {
        Ok(_geojson) => Ok(()),
        Err(e) => Err(format!("error: {}", e))?
    }
}

#[wasm_bindgen]
pub fn get_geometry_info(geojson_input: &str) -> Result<String> {
    let geojson = GeoJson::from_str(geojson_input).map_err(|e| {
        format!("error: {}", e)
    })?;

    let geometry: Geometry<f64> = match geojson.try_into() {
        Ok(geom) => geom,
        Err(e) => Err(format!("error: {}", e))?
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

    Ok(format!("type: {}", info))
}