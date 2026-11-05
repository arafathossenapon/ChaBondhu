export enum Role {
  ADMIN = "ADMIN",
  FACTORY = "FACTORY",
  GROWER = "GROWER",
}

// Role hierarchy key:value pairs
export const RoleHierarchy: { [key in Role]: number } = {
  [Role.ADMIN]: 3,
  [Role.FACTORY]: 2,
  [Role.GROWER]: 1,
};
