import { isBlobConfigured } from "../../lib/blob-auth.js";
import { createShipBlob } from "../../lib/ships-storage-blob.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!isBlobConfigured()) {
    res.status(503).json({
      error:
        "Blob storage is not connected. In Vercel: Storage → connect a Blob store to this project (adds BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN), then redeploy.",
    });
    return;
  }

  try {
    const result = await createShipBlob();
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    const message =
      err && typeof err === "object" && "message" in err && typeof err.message === "string"
        ? err.message
        : "Internal server error";
    res.status(500).json({ error: message });
  }
}
