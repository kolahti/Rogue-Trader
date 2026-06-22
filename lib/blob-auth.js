/** Blob auth: OIDC on Vercel (store connected) or BLOB_READ_WRITE_TOKEN locally. */

export function isBlobConfigured() {
  // Connected Blob store on Vercel injects BLOB_STORE_ID; OIDC token is runtime-managed.
  if (process.env.BLOB_STORE_ID) return true;
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  return false;
}

/** Only pass token when explicitly set — do not pass undefined or OIDC auth is blocked. */
export function blobCommandOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return token ? { token } : {};
}
