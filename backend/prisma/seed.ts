import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clean up any existing data
  await prisma.stockLog.deleteMany({});
  await prisma.customerOrder.deleteMany({});
  await prisma.internalTransfer.deleteMany({});
  await prisma.workOrder.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("Cleared old database records.");

  // Create Users
  const passwordHashAdmin = await bcrypt.hash("Admin@123", 10);
  const passwordHashOps = await bcrypt.hash("Ops@123", 10);
  const passwordHashSales = await bcrypt.hash("Sales@123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@fundsroom.local",
      passwordHash: passwordHashAdmin,
      role: Role.ADMIN,
    },
  });

  const ops = await prisma.user.create({
    data: {
      name: "Operations User",
      email: "ops@fundsroom.local",
      passwordHash: passwordHashOps,
      role: Role.OPERATIONS_USER,
    },
  });

  const sales = await prisma.user.create({
    data: {
      name: "Sales User",
      email: "sales@fundsroom.local",
      passwordHash: passwordHashSales,
      role: Role.SALES_USER,
    },
  });

  console.log("Users seeded successfully.");

  // Create Inventory Items
  const items = [
    {
      item: "Item-A",
      category: "Electronics",
      location: "Warehouse-1",
      batch: "B-001",
      physicalQty: 100,
      reservedQty: 0,
    },
    {
      item: "Item-A",
      category: "Electronics",
      location: "Warehouse-2",
      batch: "B-001",
      physicalQty: 50,
      reservedQty: 0,
    },
    {
      item: "Item-B",
      category: "Accessories",
      location: "Warehouse-1",
      batch: "B-002",
      physicalQty: 80,
      reservedQty: 20,
    },
    {
      item: "Item-B",
      category: "Accessories",
      location: "Warehouse-2",
      batch: "B-002",
      physicalQty: 30,
      reservedQty: 0,
    },
    {
      item: "Item-C",
      category: "Raw Material",
      location: "Warehouse-1",
      batch: "B-003",
      physicalQty: 60,
      reservedQty: 10,
    },
  ];

  for (const itemData of items) {
    const inv = await prisma.inventoryItem.create({
      data: itemData,
    });

    // Log the initial stock movement
    await prisma.stockLog.create({
      data: {
        item: inv.item,
        location: inv.location,
        batch: inv.batch,
        quantity: inv.physicalQty,
        reservedChange: inv.reservedQty,
        type: "INITIAL",
        referenceId: "SYSTEM_SEED",
      },
    });
  }

  console.log("Inventory items seeded successfully.");
  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
