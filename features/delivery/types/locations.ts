/** Row shape for delivery locations table (API + UI) */
export type DeliveryLocationRow = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  locationId: string | null;
  createdAt: string;
};

/** Option from /api/delivery/location or location list (for dropdowns in locations table) */
export type LocationOption = {
  id: string;
  code: string;
  name: string;
};

/** Option for stop dialog: delivery location with name + address (from /api/delivery/location list in StopDialog) */
export type DeliveryLocationOption = {
  id: string;
  name: string;
  address: string | null;
};
