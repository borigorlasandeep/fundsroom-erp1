import { PrismaClient, Role, CustomerType, CustomerStatus, MovementType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const users = [
    ["Admin User", "admin@fundsroom.local", "Admin@123", Role.ADMIN],
    ["Sales User", "sales@fundsroom.local", "Sales@123", Role.SALES],
    ["Warehouse User", "warehouse@fundsroom.local", "Warehouse@123", Role.WAREHOUSE],
    ["Accounts User", "accounts@fundsroom.local", "Accounts@123", Role.ACCOUNTS]
  ] as const;

  const createdUsers: Record<string, number> = {};

  for (const [name, email, password, role] of users) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role, name },
      create: { name, email, passwordHash, role }
    });
    createdUsers[role] = user.id;
  }

  const existingCustomer = await prisma.customer.findFirst();
  if (!existingCustomer) {
    await prisma.customer.create({
      data: {
        name: "Apex Retail",
        mobile: "9876543210",
        email: "apex@example.com",
        businessName: "Apex Retail Store",
        gstNumber: "24ABCDE1234F1Z5",
        type: CustomerType.RETAIL,
        address: "Vadodara, Gujarat",
        status: CustomerStatus.ACTIVE,
        notes: "Demo customer",
        createdById: createdUsers.ADMIN
      }
    });
  }

  const existingProduct = await prisma.product.findFirst();
  if (!existingProduct) {
    const product = await prisma.product.create({
      data: {
        name: "Wireless Keyboard",
        sku: "KB-1001",
        category: "Computer Accessories",
        unitPrice: 899,
        currentStock: 50,
        minStockQty: 10,
        warehouse: "Main Warehouse",
        createdById: createdUsers.WAREHOUSE
      }
    });

    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        quantity: 50,
        type: MovementType.IN,
        reason: "Opening stock",
        createdById: createdUsers.WAREHOUSE
      }
    });
  }

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
