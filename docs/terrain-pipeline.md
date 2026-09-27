# Mars Terrain Pipeline

The browser does not fetch Mars topography at runtime. The checked-in terrain tile was produced offline from the NASA Mars Global Surveyor MOLA MEGDR PDS product:

`NASA MOLA MEGDR -> offline PDS crop/conversion -> src/data/mola-regional.json -> Three.js regional LOD and shared terrain sampler`

The PDS Geosciences Node Mars Orbital Data Explorer is the authoritative download/index source:

- https://ode.rsl.wustl.edu/mars/
- https://ode.rsl.wustl.edu/mars/datasets
- Product: `MGS-M-MOLA-5-MEGDR-L3-V1.0`, `MEGT44N000HB.IMG` (topography, not `MEGC` counts)
- Archive: https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/
- Resolution: 128 pixels/degree, 463 m/pixel, 16-bit signed big-endian metres
- Source tile bounds: 0–90° east, 0–44° north; Jezero (18.38°N, 77.58°E) is inside the tile

The checked-in crop covers 76.5–78.7°E, 17.3–19.5°N. To regenerate without downloading the full 129.8 MB PDS tile, fetch only the Jezero rows (23,040 bytes per 128 px/degree row) and the small label:

```powershell
$firstRow = 3135
$endRowExclusive = 3420
$recordBytes = 23040
$firstByte = $firstRow * $recordBytes
$lastByte = $endRowExclusive * $recordBytes - 1
curl.exe -L --fail --range "$firstByte-$lastByte" --output scratch/megt44n000hb-jezero-rows.img https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/megt44n000hb.img
curl.exe -L --fail --output scratch/megt44n000hb.lbl https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/megt44n000hb.lbl
npm run terrain:mola -- scratch/megt44n000hb-jezero-rows.img src/data/mola-regional.json --label scratch/megt44n000hb.lbl --bounds 76.5,17.3,78.7,19.5 --row-offset 3135 --product MEGT44N000HB.IMG
```

The checked-in JSON is 283×283 (80,089 samples, 480,932 bytes); raw elevations range from −3,615 m to −514 m, and the correctly georeferenced bilinear Jezero anchor elevation is −2,649.9 m. The crop uses PDS rows 3,135–3,417. Coordinates are mapped around 18.38°N, 77.58°E using a local tangent approximation: positive local X is east, positive local Z is north. Heights are normalized by subtracting the anchor sample, so local render, terrain analysis, rover/touchdown placement, dust, rocks, and camera collision share one datum. Bilinear MOLA sampling is cached as static imported data; no parsing or network requests occur per frame.

The renderer uses three height scales: a 500 km distant regional LOD; a 60×60 km medium MOLA mesh at 128×128 subdivisions (about 469 m per mesh cell, matching the 463 m source resolution); and the 1.2 km landing patch with procedural crater, obstacle, and dust detail. MOLA regional elevation is rendered near physical vertical scale; only the existing local geological detail is exaggerated. A 16 km regional grade window is used for hazard slopes because the global MEGDR bin spacing is 463 m.

Procedural terrain remains only as an out-of-crop/missing-asset fallback and as local crater, obstacle, rock, and micro-detail. The developer overlay (`D`) reports `NASA MOLA`, product, bounds, sample count, and source elevation range when loaded.

## Runtime LOD

- Above 30 km: landing terrain is culled; Mars globe and orbital scene remain active.
- 30 km to 12 km: regional terrain and distant mesa formations are active.
- Below 12 km: local Jezero heightfield, crater relief, and instanced boulders are active.
- Surface: the local terrain remains active for rover inspection and collision alignment.
