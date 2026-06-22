import { get, put } from "@vercel/blob";
import { blankSheet, generateId, shipPathname } from "./ships-core.js";

const BLOB_OPTIONS = { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN };

export async function createShipBlob() {
  const id = generateId();
  const sheet = blankSheet(id);
  await put(shipPathname(id), JSON.stringify(sheet, null, 2), {
    ...BLOB_OPTIONS,
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json",
  });
  return { id, url: `/s/${id}` };
}

export async function loadShipBlob(id) {
  try {
    const result = await get(shipPathname(id), BLOB_OPTIONS);
    if (!result || result.statusCode === 404 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "BlobNotFoundError") {
      return null;
    }
    throw err;
  }
}

export async function saveShipBlob(id, sheet) {
  await put(shipPathname(id), JSON.stringify(sheet, null, 2), {
    ...BLOB_OPTIONS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}
