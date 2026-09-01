import Papa from "papaparse";

export async function loadCSV(path) {
  const res = await fetch(path);
  const text = await res.text();

  return new Promise((resolve) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        resolve(result.data);
      },
    });
  });
}