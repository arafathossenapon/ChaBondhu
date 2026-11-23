import { ConflictException } from "@nestjs/common";
import { EntityManager } from "typeorm";

export async function requirePayableAmount(
  manager: EntityManager,
  orderId: number,
): Promise<string> {
  // PostgreSQL NUMERIC দিয়ে হিসাব করলে দশমিকের নির্ভুলতা বজায় থাকে।
  const [row] = await manager.query(
    `SELECT ROUND(agreed_price_per_kg * actual_collected_weight_kg, 2)::numeric(19,2)::text AS amount
     FROM orders WHERE id = $1 AND actual_collected_weight_kg > 0
       AND ROUND(agreed_price_per_kg * actual_collected_weight_kg, 2) >= 0.01`,
    [orderId],
  );
  if (!row) throw new ConflictException("Order has no payable amount");
  return row.amount;
}
