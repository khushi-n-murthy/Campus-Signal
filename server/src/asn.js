// Opens MaxMind's free GeoLite2-ASN database (downloaded and kept fresh by geolite2-redist).
import { open } from 'geolite2-redist';
import maxmind from 'maxmind';

export async function openAsnDatabase() {
  const reader = await open('GeoLite2-ASN', (path) => maxmind.open(path));
  return {
    lookup: (ip) => reader.get(ip),
    close: () => reader.close(),
  };
}
