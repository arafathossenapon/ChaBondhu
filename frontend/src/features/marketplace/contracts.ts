export type Listing = {
  id: number;
  teaGrade: string;
  estimatedQuantityKg: number;
  expectedHarvestDate: string;
  lastHarvestDate?: string | null;
  collectionLocation: string;
  qualityDescription?: string | null;
  notes?: string | null;
  status: "ACTIVE" | "RESERVED" | "SOLD" | "EXPIRED" | "CANCELLED";
  isActive: boolean;
  farmerProfile?: {
    gardenName: string;
    district: string;
    upazila: string;
    division: string;
  };
};

export type ListingPage = {
  data: Listing[];
  total: number;
  page: number;
  limit: number;
};

export function pageNumber(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function validId(value: string | undefined) {
  return (
    !!value &&
    /^\d+$/.test(value) &&
    Number(value) >= 1 &&
    Number(value) <= 2147483647
  );
}
