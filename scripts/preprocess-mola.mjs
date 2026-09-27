import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const inputFile = args[0];
const outputFile = args[1] || 'src/data/mola-regional.json';
const option = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const rowOffset = Number(option('--row-offset', '0'));

if (!inputFile) {
  console.error('Usage: node scripts/preprocess-mola.mjs <PDS .img|ESRI .asc> [output.json] [--label file.lbl] [--bounds west,south,east,north]');
  process.exit(1);
}

const bounds = (option('--bounds', '76.5,17.3,78.7,19.5')).split(',').map(Number);
if (bounds.length !== 4 || bounds.some((value) => !Number.isFinite(value))) {
  throw new Error('Bounds must be west,south,east,north in east-positive planetocentric degrees.');
}
const [west, south, east, north] = bounds;
const extension = path.extname(inputFile).toLowerCase();
let output;

if (extension === '.img' || extension === '.dat') {
  const labelFile = option('--label', inputFile.replace(/\.[^.]+$/, '.lbl'));
  const label = fs.readFileSync(labelFile, 'utf8');
  const field = (name) => {
    const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = label.match(new RegExp(`^\\s*${safeName}\\s*=\\s*([^\\r\\n]+)`, 'im'));
    if (!match) throw new Error(`Missing ${name} in PDS label ${labelFile}`);
    return match[1].trim().replace(/^"|"$/g, '');
  };
  const lines = Number(field('LINES'));
  const samples = Number(field('LINE_SAMPLES'));
  const bits = Number(field('SAMPLE_BITS'));
  const type = field('SAMPLE_TYPE');
  const maxLat = Number(field('MAXIMUM_LATITUDE').split(/[ <]/)[0]);
  const minLat = Number(field('MINIMUM_LATITUDE').split(/[ <]/)[0]);
  const westLon = Number(field('WESTERNMOST_LONGITUDE').split(/[ <]/)[0]);
  const eastLon = Number(field('EASTERNMOST_LONGITUDE').split(/[ <]/)[0]);
  const pixelsPerDegree = Number(field('MAP_RESOLUTION').split(/[ <]/)[0]);
  const labelRecordBytes = Number(field('RECORD_BYTES'));
  const imagePointer = field('^IMAGE');
  const pointerRecord = imagePointer.match(/,\s*(\d+)\s*$/);
  const dataOffset = pointerRecord ? (Number(pointerRecord[1]) - 1) * labelRecordBytes : 0;

  if (bits !== 16 || !type.includes('MSB_INTEGER')) throw new Error('Only 16-bit MSB_INTEGER PDS MOLA elevation images are supported.');
  if (west < westLon || east > eastLon || south < minLat || north > maxLat) {
    throw new Error(`Requested bounds exceed tile coverage ${westLon},${minLat},${eastLon},${maxLat}.`);
  }

  const raw = fs.readFileSync(inputFile);
  const cropCols = Math.round((east - west) * pixelsPerDegree) + 1;
  const cropRows = Math.round((north - south) * pixelsPerDegree) + 1;
  const heights = new Array(cropRows * cropCols);
  let minElevation = Infinity;
  let maxElevation = -Infinity;

  for (let row = 0; row < cropRows; row++) {
    const latitude = north - row / pixelsPerDegree;
    const sourceRow = Math.max(0, Math.min(lines - 1, Math.round((maxLat - latitude) * pixelsPerDegree)));
    for (let column = 0; column < cropCols; column++) {
      const longitude = west + column / pixelsPerDegree;
      const sourceColumn = Math.max(0, Math.min(samples - 1, Math.round((longitude - westLon) * pixelsPerDegree)));
      const localSourceRow = sourceRow - rowOffset;
      const byteOffset = dataOffset + (localSourceRow * samples + sourceColumn) * 2;
      const elevation = raw.readInt16BE(byteOffset);
      heights[row * cropCols + column] = elevation;
      minElevation = Math.min(minElevation, elevation);
      maxElevation = Math.max(maxElevation, elevation);
    }
  }

  output = {
    source: 'NASA Mars Global Surveyor MOLA MEGDR, PDS MGS-M-MOLA-5-MEGDR-L3-V1.0',
    product: option('--product', path.basename(inputFile).toUpperCase()),
    projection: 'Simple Cylindrical, IAU2000 planetocentric, east-positive longitude',
    sourceTileBounds: { west: westLon, south: minLat, east: eastLon, north: maxLat },
    sourceRowOffset: rowOffset,
    sourceRows: { first: rowOffset, last: rowOffset + cropRows - 1 },
    bounds: { west, south, east, north },
    anchor: { latitude: 18.38, longitude: 77.58, name: 'Jezero landing region (Mars 2020)' },
    pixelsPerDegree,
    latitudeStepDegrees: 1 / pixelsPerDegree,
    longitudeStepDegrees: 1 / pixelsPerDegree,
    ncols: cropCols,
    nrows: cropRows,
    nodata: null,
    minElevationMeters: minElevation,
    maxElevationMeters: maxElevation,
    elevationsMeters: heights,
  };
} else {
  const text = fs.readFileSync(inputFile, 'utf8').trim();
  const rows = text.split(/\r?\n/);
  const header = {};
  let cursor = 0;
  while (cursor < rows.length && Object.keys(header).length < 6) {
    const match = rows[cursor].trim().match(/^(\w+)\s+(-?\d+(?:\.\d+)?)/i);
    if (match) header[match[1].toLowerCase()] = Number(match[2]);
    cursor += 1;
  }
  if (!Number.isFinite(header.ncols) || !Number.isFinite(header.nrows) || !Number.isFinite(header.cellsize)) {
    throw new Error('Expected an ESRI ASCII grid with ncols, nrows, and cellsize headers.');
  }
  const values = rows.slice(cursor).flatMap((line) => line.trim().split(/\s+/).map(Number));
  if (values.length !== header.ncols * header.nrows) throw new Error('ESRI grid sample count does not match dimensions.');
  output = {
    source: 'NASA MOLA / PDS Geosciences Node offline export',
    projection: 'ESRI ASCII grid source coordinates preserved in metadata',
    ncols: header.ncols,
    nrows: header.nrows,
    cellsizeMeters: header.cellsize,
    nodata: header.nodata_value ?? -9999,
    elevationsMeters: values,
  };
}

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(output)}\n`);
console.log(`Wrote ${output.ncols}x${output.nrows} MOLA samples (${output.elevationsMeters.length}) to ${outputFile}`);
if (Number.isFinite(output.minElevationMeters)) console.log(`Elevation range: ${output.minElevationMeters} to ${output.maxElevationMeters} m`);
