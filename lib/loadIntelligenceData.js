// Loaders for the Intelligence dataset. Every loader memoizes its
// in-flight promise, so the many components that need the same file share
// one request and one parse no matter how many of them mount at once.
//
// The split is deliberate. The three index files (~2.4MB gzipped combined)
// back the search bars and browse lists, so they load on page mount. The
// disease-company-product map is ~2MB gzipped and ~28MB parsed — far too
// heavy to pay for on arrival when most visitors never drill into a single
// record — so it loads on the first detail view and stays cached after.

const INDEX_FILES = {
  diseases: "/data/diseases.json",
  companies: "/data/companies.json",
  products: "/data/products.json",
};

let indexPromise = null;
let mapPromise = null;

function fetchJson(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`${url} responded ${res.status}`);
    return res.json();
  });
}

// diseases + companies + products, fetched in parallel.
export function loadIndexData() {
  if (!indexPromise) {
    const entries = Object.entries(INDEX_FILES);
    indexPromise = Promise.all(entries.map(([, url]) => fetchJson(url)))
      .then((results) =>
        Object.fromEntries(entries.map(([key], i) => [key, results[i]]))
      )
      .catch((err) => {
        indexPromise = null;
        throw err;
      });
  }
  return indexPromise;
}

// The map, plus the three name-keyed indexes every detail view reads from.
// map.json joins its three entity types by name string rather than by id,
// so these are keyed by name — and normalized, since the same company can
// appear with inconsistent casing or padding across source systems.
export function loadMapData() {
  if (!mapPromise) {
    mapPromise = fetchJson("/data/map.json")
      .then((rows) => ({
        rows,
        byDisease: groupBy(rows, "diseaseName"),
        byCompany: groupBy(rows, "companyName"),
        byProduct: groupBy(rows, "productName"),
      }))
      .catch((err) => {
        mapPromise = null;
        throw err;
      });
  }
  return mapPromise;
}

export function normalizeKey(name) {
  return typeof name === "string" ? name.trim().toLowerCase() : "";
}

function groupBy(rows, field) {
  const index = new Map();
  for (const row of rows) {
    const key = normalizeKey(row[field]);
    if (!key) continue;
    const bucket = index.get(key);
    if (bucket) bucket.push(row);
    else index.set(key, [row]);
  }
  return index;
}
