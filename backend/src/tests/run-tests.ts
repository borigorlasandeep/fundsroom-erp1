import app from "../app";
import { prisma } from "../config/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}/api`;

let server: any;
let adminToken = "";
let opsToken = "";
let salesToken = "";

async function setupDatabase() {
  console.log("Setting up database for tests...");
  await prisma.stockLog.deleteMany({});
  await prisma.customerOrder.deleteMany({});
  await prisma.internalTransfer.deleteMany({});
  await prisma.workOrder.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash("Password@123", 10);

  // Create test users
  const admin = await prisma.user.create({
    data: { name: "Admin Test", email: "admin@test.local", passwordHash, role: Role.ADMIN }
  });
  const ops = await prisma.user.create({
    data: { name: "Ops Test", email: "ops@test.local", passwordHash, role: Role.OPERATIONS_USER }
  });
  const sales = await prisma.user.create({
    data: { name: "Sales Test", email: "sales@test.local", passwordHash, role: Role.SALES_USER }
  });

  // Seed test inventory
  await prisma.inventoryItem.create({
    data: { item: "Item-A", category: "Electronics", location: "Warehouse-1", batch: "B-001", physicalQty: 100, reservedQty: 0 }
  });
  await prisma.inventoryItem.create({
    data: { item: "Item-A", category: "Electronics", location: "Warehouse-2", batch: "B-001", physicalQty: 50, reservedQty: 0 }
  });

  console.log("Database initialized.");
}

async function loginUser(email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Password@123" })
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Login failed for ${email}`);
  }
  return data.token;
}

async function runTests() {
  try {
    // Start Server
    server = app.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
    });

    await setupDatabase();

    // Login users to get tokens
    adminToken = await loginUser("admin@test.local");
    opsToken = await loginUser("ops@test.local");
    salesToken = await loginUser("sales@test.local");

    console.log("\n--- STARTING TESTS ---");

    // ==========================================
    // TEST 1: Cannot reserve more than available inventory.
    // ==========================================
    console.log("\n[TEST 1] Cannot reserve more than available inventory...");
    // 1a. Try reserving 150 of Item-A at Warehouse-1 (only 100 available) -> should fail
    const res1a = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${salesToken}` },
      body: JSON.stringify({
        customerName: "Customer X",
        item: "Item-A",
        location: "Warehouse-1",
        batch: "B-001",
        quantity: 150
      })
    });
    const data1a = await res1a.json();
    if (res1a.status === 400 && !data1a.success) {
      console.log("✅ Passed: Blocked reservation of 150 (Available: 100).");
    } else {
      throw new Error(`Failed: Allowed reservation or returned wrong status. Status: ${res1a.status}`);
    }

    // 1b. Reserve 80 of Item-A at Warehouse-1 -> should succeed
    const res1b = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${salesToken}` },
      body: JSON.stringify({
        customerName: "Customer X",
        item: "Item-A",
        location: "Warehouse-1",
        batch: "B-001",
        quantity: 80
      })
    });
    const data1b = await res1b.json();
    if (res1b.status === 201 && data1b.success) {
      console.log("✅ Passed: Reserved 80 items successfully.");
    } else {
      throw new Error(`Failed: Could not reserve 80 items. Status: ${res1b.status}, Message: ${data1b.message}`);
    }

    // 1c. Try reserving 30 more items of Item-A (Available remaining: 100 - 80 = 20) -> should fail
    const res1c = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${salesToken}` },
      body: JSON.stringify({
        customerName: "Customer Y",
        item: "Item-A",
        location: "Warehouse-1",
        batch: "B-001",
        quantity: 30
      })
    });
    const data1c = await res1c.json();
    if (res1c.status === 400 && !data1c.success) {
      console.log("✅ Passed: Blocked reservation of 30 (Remaining Available: 20).");
    } else {
      throw new Error(`Failed: Allowed reservation or returned wrong status. Status: ${res1c.status}`);
    }


    // ==========================================
    // TEST 2: Cannot transfer more than available inventory.
    // ==========================================
    console.log("\n[TEST 2] Cannot transfer more than available inventory...");
    // Item-A Warehouse-1 has Physical: 100, Reserved: 80, Available: 20.
    // Try to transfer 25 from Warehouse-1 to Warehouse-2 -> should fail
    const res2a = await fetch(`${BASE_URL}/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${opsToken}` },
      body: JSON.stringify({
        sourceLocation: "Warehouse-1",
        destinationLocation: "Warehouse-2",
        item: "Item-A",
        batch: "B-001",
        quantity: 25
      })
    });
    const data2a = await res2a.json();
    if (res2a.status === 400 && !data2a.success) {
      console.log("✅ Passed: Blocked transfer of 25 (Available: 20).");
    } else {
      throw new Error(`Failed: Allowed transfer of 25 items. Status: ${res2a.status}`);
    }

    // Create a valid transfer of 15 -> should succeed
    const res2b = await fetch(`${BASE_URL}/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${opsToken}` },
      body: JSON.stringify({
        sourceLocation: "Warehouse-1",
        destinationLocation: "Warehouse-2",
        item: "Item-A",
        batch: "B-001",
        quantity: 15
      })
    });
    const data2b = await res2b.json();
    if (res2b.status === 201 && data2b.success) {
      console.log("✅ Passed: Created transfer request of 15 successfully.");
    } else {
      throw new Error(`Failed: Could not create transfer. Status: ${res2b.status}`);
    }
    const transferId = data2b.data.id;


    // ==========================================
    // TEST 3: Destination stock increases only after transfer receipt.
    // ==========================================
    console.log("\n[TEST 3] Destination stock increases only after transfer receipt...");
    // 3a. Dispatch the transfer
    const res3a = await fetch(`${BASE_URL}/transfers/${transferId}/dispatch`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${opsToken}` }
    });
    const data3a = await res3a.json();
    if (res3a.status === 200 && data3a.success) {
      console.log("✅ Passed: Transfer dispatched successfully.");
    } else {
      throw new Error(`Failed to dispatch transfer. Status: ${res3a.status}`);
    }

    // 3b. Verify source stock decreased (100 - 15 = 85 physical), but destination is STILL 50.
    const resInventory = await fetch(`${BASE_URL}/inventory`, {
      headers: { "Authorization": `Bearer ${opsToken}` }
    });
    const dataInv = await resInventory.json();
    const sourceStock = dataInv.data.find((i: any) => i.location === "Warehouse-1" && i.item === "Item-A");
    const destStock = dataInv.data.find((i: any) => i.location === "Warehouse-2" && i.item === "Item-A");

    if (sourceStock.physicalQty === 85 && destStock.physicalQty === 50) {
      console.log("✅ Passed: Source stock decreased to 85, Destination stock remains 50 before receipt.");
    } else {
      throw new Error(`Failed: Stocks incorrect. Source: ${sourceStock.physicalQty} (expected 85), Dest: ${destStock.physicalQty} (expected 50)`);
    }

    // 3c. Receive the transfer
    const res3c = await fetch(`${BASE_URL}/transfers/${transferId}/receive`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${opsToken}` }
    });
    const data3c = await res3c.json();
    if (res3c.status === 200 && data3c.success) {
      console.log("✅ Passed: Transfer received successfully.");
    } else {
      throw new Error(`Failed to receive transfer. Status: ${res3c.status}`);
    }

    // 3d. Verify destination stock increased to 65
    const resInventoryPost = await fetch(`${BASE_URL}/inventory`, {
      headers: { "Authorization": `Bearer ${opsToken}` }
    });
    const dataInvPost = await resInventoryPost.json();
    const destStockPost = dataInvPost.data.find((i: any) => i.location === "Warehouse-2" && i.item === "Item-A");
    if (destStockPost.physicalQty === 65) {
      console.log("✅ Passed: Destination stock increased to 65 after receipt.");
    } else {
      throw new Error(`Failed: Destination stock did not increase properly. Current: ${destStockPost.physicalQty}`);
    }


    // ==========================================
    // TEST 4: Same transfer cannot be received twice.
    // ==========================================
    console.log("\n[TEST 4] Same transfer cannot be received twice...");
    const res4 = await fetch(`${BASE_URL}/transfers/${transferId}/receive`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${opsToken}` }
    });
    const data4 = await res4.json();
    if (res4.status === 400 && !data4.success) {
      console.log("✅ Passed: Blocked duplicate transfer receipt.");
    } else {
      throw new Error(`Failed: Allowed double receipt. Status: ${res4.status}`);
    }


    // ==========================================
    // TEST 5: Unauthorized users cannot perform restricted operations.
    // ==========================================
    console.log("\n[TEST 5] Unauthorized users cannot perform restricted operations...");
    // 5a. Sales User attempts to create a Work Order (Admin only)
    const res5a = await fetch(`${BASE_URL}/work-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${salesToken}` },
      body: JSON.stringify({
        location: "Warehouse-1",
        item: "Item-A",
        requiredQty: 10,
        assignedUserId: 1
      })
    });
    if (res5a.status === 403) {
      console.log("✅ Passed: Sales user blocked from creating work order (403 Forbidden).");
    } else {
      throw new Error(`Failed: Sales user was not blocked (Status: ${res5a.status}).`);
    }

    // 5b. Operations User attempts to reserve customer stock (Sales/Admin only)
    const res5b = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${opsToken}` },
      body: JSON.stringify({
        customerName: "Test Cust",
        item: "Item-A",
        location: "Warehouse-1",
        batch: "B-001",
        quantity: 5
      })
    });
    if (res5b.status === 403) {
      console.log("✅ Passed: Operations user blocked from reserving customer stock (403 Forbidden).");
    } else {
      throw new Error(`Failed: Operations user was not blocked (Status: ${res5b.status}).`);
    }


    // ==========================================
    // TEST 6: Concurrency Race Condition Check (Bonus)
    // ==========================================
    console.log("\n[TEST 6] Concurrency check: Two simultaneous reservations exceeding available stock...");
    // Current state of Item-A at Warehouse-1:
    // Physical: 85, Reserved: 80, Available: 5.
    // We will launch two requests concurrently:
    // Request A: Reserve 4 items (should succeed if it goes first, or fail if B goes first)
    // Request B: Reserve 3 items (should succeed if it goes first, or fail if A goes first)
    // Since available is 5, they cannot BOTH succeed because 4 + 3 = 7 > 5.
    // One must succeed, and the other must fail!
    const reqA = fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${salesToken}` },
      body: JSON.stringify({
        customerName: "Buyer A",
        item: "Item-A",
        location: "Warehouse-1",
        batch: "B-001",
        quantity: 4
      })
    });
    const reqB = fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${salesToken}` },
      body: JSON.stringify({
        customerName: "Buyer B",
        item: "Item-A",
        location: "Warehouse-1",
        batch: "B-001",
        quantity: 3
      })
    });

    const [resA, resB] = await Promise.all([reqA, reqB]);
    const dataA = await resA.json();
    const dataB = await resB.json();

    const successA = resA.status === 201 && dataA.success;
    const successB = resB.status === 201 && dataB.success;

    console.log(`Request A (qty 4) success: ${successA}, Status: ${resA.status}`);
    console.log(`Request B (qty 3) success: ${successB}, Status: ${resB.status}`);

    if (successA && successB) {
      throw new Error("Failed: Both concurrent requests succeeded! Over-reservation allowed.");
    } else if (!successA && !successB) {
      throw new Error("Failed: Both concurrent requests failed.");
    } else {
      console.log("✅ Passed: Transaction safety verified. Only one reservation succeeded, preventing over-reservation.");
    }

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n");
    cleanupAndExit(0);
  } catch (error: any) {
    console.error("\n❌ TEST FAILURE:", error.message);
    cleanupAndExit(1);
  }
}

function cleanupAndExit(code: number) {
  if (server) {
    server.close(() => {
      console.log("Test server stopped.");
      process.exit(code);
    });
  } else {
    process.exit(code);
  }
}

runTests();
