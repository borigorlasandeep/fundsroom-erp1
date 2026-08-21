import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth";
import { CustomerOrderStatus } from "@prisma/client";
import { z } from "zod";

const createOrderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  item: z.string().min(1, "Item is required"),
  location: z.string().min(1, "Location is required"),
  batch: z.string().min(1, "Batch is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});

export async function createOrder(req: AuthRequest, res: Response) {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const { customerName, item, location, batch, quantity } = parsed.data;

    // Use a transaction with row lock to prevent race conditions
    const order = await prisma.$transaction(async (tx) => {
      // Raw SQL Lock on the specific InventoryItem
      const inventoryItems = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "InventoryItem" WHERE "item" = $1 AND "location" = $2 AND "batch" = $3 FOR UPDATE`,
        item,
        location,
        batch
      );

      if (!inventoryItems || inventoryItems.length === 0) {
        throw new Error(`Inventory item not found at location ${location} with batch ${batch}`);
      }

      const inv = inventoryItems[0];
      const available = inv.physicalQty - inv.reservedQty;

      // MANDATORY TEST CHECK: Cannot reserve more than available inventory.
      if (available < quantity) {
        throw new Error(`Cannot reserve more than available inventory. Available: ${available}, Requested: ${quantity}`);
      }

      // Update reserved quantity on the inventory item
      await tx.inventoryItem.update({
        where: { id: inv.id },
        data: { reservedQty: inv.reservedQty + quantity }
      });

      // Create Customer Order
      const newOrder = await tx.customerOrder.create({
        data: {
          customerName,
          item,
          location,
          batch,
          quantity,
          status: CustomerOrderStatus.RESERVED,
          createdById: req.user!.id
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, role: true }
          }
        }
      });

      // Log the reservation
      await tx.stockLog.create({
        data: {
          item,
          location,
          batch,
          quantity: 0,
          reservedChange: quantity,
          type: "CUSTOMER_RESERVE",
          referenceId: `CO-${newOrder.id}`
        }
      });

      return newOrder;
    });

    return res.status(201).json({ success: true, data: order });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function getOrders(req: AuthRequest, res: Response) {
  try {
    const orders = await prisma.customerOrder.findMany({
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.json({ success: true, data: orders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function completeOrder(req: AuthRequest, res: Response) {
  try {
    const id = parseInt(req.params.id as string);

    const order = await prisma.customerOrder.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== CustomerOrderStatus.RESERVED) {
      return res.status(400).json({ success: false, message: `Only RESERVED orders can be completed. Current status is ${order.status}` });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Row lock on inventory item
      const inventoryItems = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "InventoryItem" WHERE "item" = $1 AND "location" = $2 AND "batch" = $3 FOR UPDATE`,
        order.item,
        order.location,
        order.batch
      );

      if (!inventoryItems || inventoryItems.length === 0) {
        throw new Error("Inventory record not found during completion");
      }

      const inv = inventoryItems[0];

      // Verify and deduct physical quantity and reserved quantity
      if (inv.physicalQty < order.quantity) {
        throw new Error("Physical inventory is lower than order quantity");
      }
      if (inv.reservedQty < order.quantity) {
        throw new Error("Reserved inventory is lower than order quantity");
      }

      await tx.inventoryItem.update({
        where: { id: inv.id },
        data: {
          physicalQty: inv.physicalQty - order.quantity,
          reservedQty: inv.reservedQty - order.quantity
        }
      });

      // Log stock movement
      await tx.stockLog.create({
        data: {
          item: order.item,
          location: order.location,
          batch: order.batch,
          quantity: -order.quantity,
          reservedChange: -order.quantity,
          type: "CUSTOMER_COMPLETE",
          referenceId: `CO-${order.id}`
        }
      });

      return tx.customerOrder.update({
        where: { id },
        data: { status: CustomerOrderStatus.COMPLETED },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, role: true }
          }
        }
      });
    });

    return res.json({ success: true, data: updatedOrder });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function cancelOrder(req: AuthRequest, res: Response) {
  try {
    const id = parseInt(req.params.id as string);

    const order = await prisma.customerOrder.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== CustomerOrderStatus.RESERVED) {
      return res.status(400).json({ success: false, message: `Only RESERVED orders can be cancelled. Current status is ${order.status}` });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Row lock on inventory item
      const inventoryItems = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "InventoryItem" WHERE "item" = $1 AND "location" = $2 AND "batch" = $3 FOR UPDATE`,
        order.item,
        order.location,
        order.batch
      );

      if (!inventoryItems || inventoryItems.length === 0) {
        throw new Error("Inventory record not found during cancellation");
      }

      const inv = inventoryItems[0];

      // Release the reserved quantity
      await tx.inventoryItem.update({
        where: { id: inv.id },
        data: {
          reservedQty: Math.max(0, inv.reservedQty - order.quantity)
        }
      });

      // Log stock movement
      await tx.stockLog.create({
        data: {
          item: order.item,
          location: order.location,
          batch: order.batch,
          quantity: 0,
          reservedChange: -order.quantity,
          type: "CUSTOMER_RELEASE",
          referenceId: `CO-${order.id}`
        }
      });

      return tx.customerOrder.update({
        where: { id },
        data: { status: CustomerOrderStatus.CANCELLED },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, role: true }
          }
        }
      });
    });

    return res.json({ success: true, data: updatedOrder });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
