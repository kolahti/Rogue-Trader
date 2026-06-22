import { get, put } from "@vercel/blob";
import { blobCommandOptions } from "./blob-auth.js";
import { blankSheet, generateId, shipPathname } from "./ships-core.js";

function putOptions(extra = {}) {
  return {
    ...blobCommandOptions(),
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    ...extra,
  };
}

export async function createShipBlob() {
  const id = generateId();
  const sheet = blankSheet(id);
  await put(shipPathname(id), JSON.stringify(sheet, null, 2), putOptions());
  return { id, url: `/s/${id}` };
}

export async function loadShipBlob(id) {
  try {
    const result = await get(shipPathname(id), {
      ...blobCommandOptions(),
      access: "public",
    });
    if (!result?.stream) return null;
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
  await put(shipPathname(id), JSON.stringify(sheet, null, 2), putOptions({ allowOverwrite: true }));
}
