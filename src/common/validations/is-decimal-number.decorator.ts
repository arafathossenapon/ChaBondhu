import { ValidateBy } from "class-validator";

export function IsDecimalNumber(places: number): PropertyDecorator {
  return ValidateBy({
    name: "isDecimalNumber",
    validator: {
      validate: (value: unknown) =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        Number(value.toFixed(places)) === value,
      defaultMessage: () =>
        `Value must be a number with up to ${places} decimal places`,
    },
  });
}
