import { del, list, put } from "@vercel/blob";
import { blankSheet, generateId, shipPathname } from "./ships-core.js";

const blobOpts = () => ({ token: process.env.BLOB_READ_WRITE_TOKEN });

async function findBlob(id) {
  const pathname = shipPathname(id);
  const { blobs } = await list({ ...blobOpts(), prefix: pathname, limit: 10 });
  return blobs.find((b) => b.pathname === pathname) ?? null;
}

export async function createShipBlob() {
  const id = generateId();
  const sheet = blankSheet(id);
  await put(shipPathname(id), JSON.stringify(sheet, null, 2), {
    ...blobOpts(),
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
  return { id, url: `/s/${id}` };
}

export async function loadShipBlob(id) {
  try {
    const blob = await findBlob(id);
    if (!blob) return null;
    const res = await fetch(blob.downloadUrl);
    if (!res.ok) return null;
    return JSON.parse(await res.text());
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "BlobNotFoundError") {
      return null;
    }
    throw err;
  }
}

export async function saveShipBlob(id, sheet) {
  const pathname = shipPathname(id);
  const existing = await findBlob(id);
  if (existing) await del(existing.url, blobOpts());
  await put(pathname, JSON.stringify(sheet, null, 2), {
    ...blobOpts(),
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
}
