import { PaleoGeographyProvider } from "./PaleoGeographyProvider";
import { PALEO_SLICES } from "./slices";

async function fetchFromBase(url: string): Promise<unknown> {
  const res = await fetch(`${import.meta.env.BASE_URL}${url}`);
  if (!res.ok) throw new Error(`加载失败（HTTP ${res.status}）：${url}`);
  return res.json();
}

export const paleoGeographyProvider = new PaleoGeographyProvider(PALEO_SLICES, { fetchJson: fetchFromBase });
