import { fetchStaticJson } from "../fetchStatic";
import { PaleoGeographyProvider } from "./PaleoGeographyProvider";
import { PALEO_SLICES } from "./slices";

export const paleoGeographyProvider = new PaleoGeographyProvider(PALEO_SLICES, { fetchJson: fetchStaticJson });
