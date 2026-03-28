interface GeoResult {
  lat: number;
  lng: number;
}

export async function geocodeAddress(address: string): Promise<GeoResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    // Fallback: return Nashville area coords for demo
    console.warn("No GOOGLE_MAPS_API_KEY, using fallback coordinates");
    return { lat: 36.16 + Math.random() * 0.02, lng: -86.78 - Math.random() * 0.02 };
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
  const res = await fetch(url);
  const data: any = await res.json();

  if (data.status !== "OK" || !data.results?.length) {
    throw new Error(`Geocoding failed for "${address}": ${data.status}`);
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}
