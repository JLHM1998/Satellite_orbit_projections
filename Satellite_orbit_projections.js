// ================================
// 1. HISTÓRICO Y CONFIGURACIÓN INICIAL
// ================================

var geometry = /* color: #d63000 */ee.Geometry.Point([-79.78408456853869, -6.592405637237123]);

// Definir la zona horaria de Perú (UTC-5)
var offsetHours = -5;

// Definir la región de interés
var geometry = geometry;
var region = geometry;

// Definir el rango histórico para el análisis: 
// (en este ejemplo, del 1‑oct‑2021 al 31‑ene‑2025)
var startDate = '2021-10-01';
var endDate   = '2025-01-31';

// Intervalos de revisita (días)
var delta_L8 = 16; // Landsat 8
var delta_L9 = 16; // Landsat 9
var delta_S2 = 5;  // Sentinel-2

// Cargar colecciones de imágenes en el rango histórico
var landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_RT')
  .filterBounds(region)
  .filterDate(startDate, endDate)
  .sort('system:time_start');

var landsat9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_RT')
  .filterBounds(region)
  .filterDate(startDate, endDate)
  .sort('system:time_start');

var sentinel2 = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
  .filterBounds(region)
  .filterDate(startDate, endDate)
  .sort('system:time_start', false);

// Función para extraer la fecha completa (con hora) de cada imagen y ajustarla a hora local peruana
var getDates = function(image) {
  // Ajustar la fecha a hora local (UTC-5)
  var date = ee.Date(image.get('system:time_start')).advance(offsetHours, 'hour');
  return ee.Feature(null, {
    'date_ymdh': date.format('YYYY-MM-dd HH:mm'),
    'system_time': date.millis()
  });
};

// Obtener listas de fechas históricas (ya en hora local)
var dates_L8 = landsat8.map(getDates);
var dates_L9 = landsat9.map(getDates);
var dates_S2 = sentinel2.map(getDates);

var datesList_L8 = dates_L8.aggregate_array('date_ymdh').getInfo();
var datesList_L9 = dates_L9.aggregate_array('date_ymdh').getInfo();
var datesList_S2 = dates_S2.aggregate_array('date_ymdh').getInfo();

print('📅 Fechas Landsat 8 (histórico):', datesList_L8);
print('📅 Fechas Landsat 9 (histórico):', datesList_L9);
print('📅 Fechas Sentinel-2 (histórico):', datesList_S2);

// Obtener la última imagen de Landsat 8 y Sentinel-2 (se asume que hay imágenes)
var last_L8 = landsat8.sort('system:time_start', false).first();
var last_S2 = sentinel2.first();

// Ajustar la última fecha a hora local
var last_date_L8 = ee.Date(last_L8.get('system:time_start')).advance(offsetHours, 'hour');
var last_date_S2 = ee.Date(last_S2.get('system:time_start')).advance(offsetHours, 'hour');

print('📅 Última fecha Landsat 8:', last_date_L8.format('YYYY-MM-dd HH:mm'));
print('📅 Última fecha Sentinel-2:', last_date_S2.format('YYYY-MM-dd HH:mm'));

// Para Landsat 9: verificar si existen imágenes en el rango histórico
var countL9 = landsat9.size().getInfo();
print('Número de imágenes Landsat 9 (histórico):', countL9);

if (countL9 > 0) {
  var last_L9 = landsat9.sort('system:time_start', false).first();
  var last_date_L9 = ee.Date(last_L9.get('system:time_start')).advance(offsetHours, 'hour');
  print('📅 Última fecha Landsat 9:', last_date_L9.format('YYYY-MM-dd HH:mm'));
  
  // (Opcional) Generar fechas futuras inmediatas para Landsat 9
  var future_dates_L9 = ee.List.sequence(0, 64, delta_L9).map(function(ddays) {
    return last_date_L9.advance(ee.Number(ddays), 'day').format('YYYY-MM-dd HH:mm');
  }).getInfo();
  print('🚀 Fechas futuras Landsat 9 (según último registro):', future_dates_L9);
  
  Map.addLayer(last_L9, {min: 6135, max: 15101, bands: ['B4','B3','B2']}, 'Última Imagen Landsat 9');
} else {
  print('No hay imágenes Landsat 9 en el rango histórico.');
}

// Generar fechas futuras inmediatas para Landsat 8 y Sentinel-2 (según último registro)
var future_dates_L8 = ee.List.sequence(0, 64, delta_L8).map(function(ddays) {
  return last_date_L8.advance(ee.Number(ddays), 'day').format('YYYY-MM-dd HH:mm');
}).getInfo();

var future_dates_S2 = ee.List.sequence(0, 64, delta_S2).map(function(ddays) {
  return last_date_S2.advance(ee.Number(ddays), 'day').format('YYYY-MM-dd HH:mm');
}).getInfo();

print('🚀 Fechas futuras Landsat 8 (según último registro):', future_dates_L8);
print('🚀 Fechas futuras Sentinel-2 (según último registro):', future_dates_S2);

Map.centerObject(region, 10);
Map.addLayer(last_L8, {min: 6135, max: 15101, bands: ['B4','B3','B2']}, 'Última Imagen Landsat 8');
Map.addLayer(last_S2, {min: 0, max: 3000, bands: ['B4','B3','B2']}, 'Última Imagen Sentinel-2');


// ================================
// 2. CÁLCULO DE LA HORA TÍPICA A PARTIR DEL HISTÓRICO
// ================================

// Función para extraer la parte de la hora ("HH:mm") de una fecha formateada "YYYY-MM-dd HH:mm"
function extractTime(datetimeStr) {
  return datetimeStr.substring(11, 16); // extrae caracteres del índice 11 al 15
}

// Extraer las horas de cada historial (ya en hora local)
var times_L8 = datesList_L8.map(extractTime);
var times_L9 = datesList_L9.map(extractTime);
var times_S2 = datesList_S2.map(extractTime);

// Función para calcular la moda (valor que más se repite) en un arreglo
function mode(arr) {
  var frequency = {};
  var max = 0;
  var modeVal = "";
  arr.forEach(function(item) {
    frequency[item] = (frequency[item] || 0) + 1;
    if (frequency[item] > max) {
      max = frequency[item];
      modeVal = item;
    }
  });
  return modeVal;
}

var typicalTime_L8 = mode(times_L8);
var typicalTime_S2 = mode(times_S2);
var typicalTime_L9 = (times_L9.length > 0) ? mode(times_L9) : "00:00";

print('⏰ Hora típica Landsat 8:', typicalTime_L8);
print('⏰ Hora típica Landsat 9:', typicalTime_L9);
print('⏰ Hora típica Sentinel-2:', typicalTime_S2);


// ================================
// 3. GENERACIÓN DE FECHAS Y HORAS PREDICHAS (OCTUBRE 2024 - JUNIO 2025)
// ================================

// Definir el rango de predicción (ajustado a la hora local peruana)
var pred_start = ee.Date("2024-10-01").advance(offsetHours, 'hour');
var pred_end   = ee.Date("2025-06-30").advance(offsetHours, 'hour');

// Para Landsat 8: usar la última fecha histórica si es posterior a pred_start; si no, se usa pred_start.
var base_pred_L8 = ee.Date(ee.Algorithms.If(
  ee.Date(last_date_L8).difference(pred_start, 'day').gte(0),
  last_date_L8,
  pred_start
));

// Para Landsat 9:
// - Si existen imágenes históricas y su última fecha es posterior a pred_start, se utiliza esa.
// - En caso contrario, se usa la base de Landsat 8.
// En ambos casos se aplica un offset de 8 días para reflejar la diferencia real.
var base_pred_L9 = ee.Date(ee.Algorithms.If(
  (countL9 > 0) && ee.Date(last_date_L9).difference(pred_start, 'day').gte(0),
  last_date_L9,
  base_pred_L8
)).advance(8, 'day');

// Para Sentinel-2: se aplica la misma lógica que para Landsat 8.
var base_pred_S2 = ee.Date(ee.Algorithms.If(
  ee.Date(last_date_S2).difference(pred_start, 'day').gte(0),
  last_date_S2,
  pred_start
));

// Calcular la cantidad de días disponibles para proyectar desde cada base hasta pred_end
var diffDays_L8 = pred_end.difference(base_pred_L8, 'day').round().getInfo();
var diffDays_L9 = pred_end.difference(base_pred_L9, 'day').round().getInfo();
var diffDays_S2 = pred_end.difference(base_pred_S2, 'day').round().getInfo();

// Generar secuencias de fechas (formato "YYYY-MM-dd") para cada satélite según su intervalo de revisita
var predicted_dates_L8 = ee.List.sequence(0, diffDays_L8, delta_L8).map(function(ddays) {
  return base_pred_L8.advance(ee.Number(ddays), 'day').format('YYYY-MM-dd');
}).getInfo();

var predicted_dates_L9 = ee.List.sequence(0, diffDays_L9, delta_L9).map(function(ddays) {
  return base_pred_L9.advance(ee.Number(ddays), 'day').format('YYYY-MM-dd');
}).getInfo();

var predicted_dates_S2 = ee.List.sequence(0, diffDays_S2, delta_S2).map(function(ddays) {
  return base_pred_S2.advance(ee.Number(ddays), 'day').format('YYYY-MM-dd');
}).getInfo();

// Incorporar la hora típica a cada fecha para formar la fecha completa (local)
var predicted_with_time_L8 = predicted_dates_L8.map(function(dateStr) {
  return dateStr + " " + typicalTime_L8;
});
var predicted_with_time_L9 = predicted_dates_L9.map(function(dateStr) {
  return dateStr + " " + typicalTime_L9;
});
var predicted_with_time_S2 = predicted_dates_S2.map(function(dateStr) {
  return dateStr + " " + typicalTime_S2;
});

// Comparar con el historial:
// Si la fecha predicha ya existe en el histórico se muestra normal,
// de lo contrario se encierra entre asteriscos (simulando "negrita")
var final_dates_L8 = predicted_with_time_L8.map(function(dateTimeStr) {
  return (datesList_L8.indexOf(dateTimeStr) > -1) ? dateTimeStr : '**' + dateTimeStr + '**';
});
var final_dates_L9 = predicted_with_time_L9.map(function(dateTimeStr) {
  return (datesList_L9.indexOf(dateTimeStr) > -1) ? dateTimeStr : '**' + dateTimeStr + '**';
});
var final_dates_S2 = predicted_with_time_S2.map(function(dateTimeStr) {
  return (datesList_S2.indexOf(dateTimeStr) > -1) ? dateTimeStr : '**' + dateTimeStr + '**';
});

print('🔮 Fechas proyectadas Landsat 8 (Oct 2024 - Jun 2025):', final_dates_L8);
print('🔮 Fechas proyectadas Landsat 9 (Oct 2024 - Jun 2025):', final_dates_L9);
print('🔮 Fechas proyectadas Sentinel-2 (Oct 2024 - Jun 2025):', final_dates_S2);

