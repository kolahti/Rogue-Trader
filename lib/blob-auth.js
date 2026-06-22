/** Blob auth: OIDC on Vercel (BLOB_STORE_ID) or BLOB_READ_WRITE_TOKEN for local dev. */

export function isBlobConfigured() {
  if (process.env.BLOB_STORE_ID) return true;
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  return false;
}

/**
 * Credential options for @vercel/blob v2+.
 * Do not pass `token` unless set — lets the SDK use OIDC (VERCEL_OIDC_TOKEN + BLOB_STORE_ID).
 */
export function blobCommandOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return { token };

  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (storeId) return { storeId };

  return {};
}
