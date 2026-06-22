import { isBlobConfigured } from "../../lib/blob-auth.js";
import { isValidShipId, validateSheet } from "../../lib/ships-core.js";
import { loadShipBlob, saveShipBlob } from "../../lib/ships-storage-blob.js";

export default async function handler(req, res) {
  const id = req.query.id;

  if (!isValidShipId(id)) {
    res.status(400).json({ error: "Invalid ship id" });
    return;
  }

  if (!isBlobConfigured()) {
    res.status(503).json({
      error:
        "Blob storage is not connected. In Vercel: Project → Storage → connect a Blob store to this project, then redeploy.",
    });
    return;
  }

  try {
    if (req.method === "GET") {
      const sheet = await loadShipBlob(id);
      if (!sheet) {
        res.status(404).json({ error: "Ship not found" });
        return;
      }
      res.status(200).json(sheet);
      return;
    }

    if (req.method === "PUT") {
      const sheet =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const validationError = validateSheet(sheet);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
      sheet.id = id;
      await saveShipBlob(id, sheet);
      res.status(200).json({ id });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    const message =
      err && typeof err === "object" && "message" in err && typeof err.message === "string"
        ? err.message
        : "Internal server error";
    res.status(500).json({ error: message });
  }
}
