/**
 * The three columns of a product that can be typed over where they are
 * read — in the product table and in the cost-and-profit table.
 *
 * Here rather than beside the action that writes them, because a
 * `"use server"` module may only export async functions, and the tables
 * that call it need the name of the column as a value as well as a type.
 */
export const PRODUCT_NUMBER_FIELDS = {
  price: "price",
  stock: "stock",
  cost: "costPrice",
} as const;

export type ProductNumberField = keyof typeof PRODUCT_NUMBER_FIELDS;
