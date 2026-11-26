import { z } from "zod";

export const profileKinds = {
  grower: {
    path: "/farmer-profiles",
    title: "Grower profile",
    fields: [
      { name: "gardenName", label: "Garden name", max: 200 },
      { name: "division", label: "Division", max: 100 },
      { name: "district", label: "District", max: 100 },
      { name: "upazila", label: "Upazila", max: 100 },
    ],
  },
  factory: {
    path: "/factory-profiles",
    title: "Factory profile",
    fields: [
      { name: "factoryName", label: "Factory name", max: 200 },
      { name: "representativeName", label: "Representative name", max: 150 },
      { name: "district", label: "District", max: 100 },
      { name: "upazila", label: "Upazila", max: 100 },
    ],
  },
};

export type ProfileKind = keyof typeof profileKinds;
export const verificationStatus = z.enum(["PENDING", "VERIFIED", "REJECTED"]);
export const reviewHistory = z.array(
  z.object({
    decision: z.enum(["VERIFIED", "REJECTED"]),
    reason: z.string().nullable(),
  }),
);

export function profileSchema(kind: ProfileKind) {
  return z.object(
    Object.fromEntries(
      profileKinds[kind].fields.map(({ name, max }) => [
        name,
        z.string().trim().min(2, "Enter at least two characters.").max(max),
      ]),
    ),
  );
}

export function parseProfile(kind: ProfileKind, data: unknown) {
  const details = profileSchema(kind).parse(data);
  if (kind === "grower") return { details };
  return {
    details,
    status: z.object({ verificationStatus }).parse(data).verificationStatus,
  };
}
