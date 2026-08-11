import { prisma } from "../config/prisma";

export async function generateChallanNumber() {
  const count = await prisma.challan.count();
  const year = new Date().getFullYear();
  return `CH-${year}-${String(count + 1).padStart(5, "0")}`;
}
