/** Fetch an asset and fail at the request boundary with its path and status. */
export async function fetchChecked(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const status = response.status || 'unknown';
    const detail = response.statusText ? ` ${response.statusText}` : '';
    throw new Error(`${url}: HTTP ${status}${detail}`);
  }
  return response;
}

export async function fetchJSON(url, init) {
  return (await fetchChecked(url, init)).json();
}

export async function fetchBytes(url, init) {
  return new Uint8Array(await (await fetchChecked(url, init)).arrayBuffer());
}
