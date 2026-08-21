import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth";
import { TransferStatus } from "@prisma/client";
import { z } from "zod";

const createTransferSchema = z.object({
  sourceLocation: z.string().min(1, "Source location is required"),
  destinationLocation: z.string().min(1, "Destination location is required"),
  item: z.string().min(1, "Item is required"),
  batch: z.string().min(1, "Batch is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});

export async function createTransfer(req: AuthRequest, res: Response) {
  try {
    const parsed = createTransferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const { sourceLocation, destinationLocation, item, batch, quantity } = parsed.data;

    if (sourceLocation === destinationLocation) {
      return res.status(400).json({ success: false, message: "Source and destination locations must be different" });
    }

    // Verify source inventory item exists and has enough available quantity
    const sourceInv = await prisma.inventoryItem.findUnique({
      where: {
        item_location_batch: {
          item,
          location: sourceLocation,
          batch
        }
      }
    });

    if (!sourceInv) {
      return res.status(400).json({ success: false, message: `No stock found for item ${item} at ${sourceLocation} with batch ${batch}` });
    }

    const available = sourceInv.physicalQty - sourceInv.reservedQty;
    if (available < quantity) {
      return res.status(400).json({
        success: false,
        message: `Cannot transfer more than available inventory. Available: ${available}, Requested: ${quantity}`
      });
    }

    const transfer = await prisma.internalTransfer.create({
      data: {
        sourceLocation,
        destinationLocation,
        item,
        batch,
        quantity,
        status: TransferStatus.REQUESTED,
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    return res.status(201).json({ success: true, data: transfer });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getTransfers(req: AuthRequest, res: Response) {
  try {
    const transfers = await prisma.internalTransfer.findMany({
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.json({ success: true, data: transfers });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function dispatchTransfer(req: AuthRequest, res: Response) {
  try {
    const id = parseInt(req.params.id as string);

    const transfer = await prisma.internalTransfer.findUnique({ where: { id } });
    if (!transfer) {
      return res.status(404).json({ success: false, message: "Transfer not found" });
    }

    if (transfer.status !== TransferStatus.REQUESTED) {
      return res.status(400).json({ success: false, message: `Only REQUESTED transfers can be dispatched. Current status is ${transfer.status}` });
    }

    // Execute dispatch in a transaction
    const updatedTransfer = await prisma.$transaction(async (tx) => {
      // Lock source inventory row
      const sourceInv = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "InventoryItem" WHERE "item" = $1 AND "location" = $2 AND "batch" = $3 FOR UPDATE`,
        transfer.item,
        transfer.sourceLocation,
        transfer.batch
      );

      if (!sourceInv || sourceInv.length === 0) {
        throw new Error("Source stock record not found");
      }

      const inv = sourceInv[0];
      const available = inv.physicalQty - inv.reservedQty;
      if (available < transfer.quantity) {
        throw new Error(`Cannot transfer more than available inventory. Available: ${available}, Requested: ${transfer.quantity}`);
      }

      // Deduct from source inventory physicalQty
      await tx.inventoryItem.update({
        where: { id: inv.id },
        data: { physicalQty: inv.physicalQty - transfer.quantity }
      });

      // Log stock movement
      await tx.stockLog.create({
        data: {
          item: transfer.item,
          location: transfer.sourceLocation,
          batch: transfer.batch,
          quantity: -transfer.quantity,
          reservedChange: 0,
          type: "TRANSFER_DISPATCH",
          referenceId: `TR-${transfer.id}`
        }
      });

      // Update transfer status to DISPATCHED
      return tx.internalTransfer.update({
        where: { id },
        data: { status: TransferStatus.DISPATCHED },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, role: true }
          }
        }
      });
    });

    return res.json({ success: true, data: updatedTransfer });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function receiveTransfer(req: AuthRequest, res: Response) {
  try {
    const id = parseInt(req.params.id as string);

    const transfer = await prisma.internalTransfer.findUnique({ where: { id } });
    if (!transfer) {
      return res.status(404).json({ success: false, message: "Transfer not found" });
    }

    // MANDATORY TEST CHECK: Same transfer cannot be received twice.
    if (transfer.status === TransferStatus.RECEIVED) {
      return res.status(400).json({ success: false, message: "This transfer has already been received" });
    }

    if (transfer.status !== TransferStatus.DISPATCHED) {
      return res.status(400).json({ success: false, message: `Only DISPATCHED transfers can be received. Current status is ${transfer.status}` });
    }

    // Execute receipt in a transaction
    const updatedTransfer = await prisma.$transaction(async (tx) => {
      // Find or create destination inventory row
      // Use raw lock on destination to prevent concurrent write issues
      await tx.$queryRawUnsafe(
        `INSERT INTO "InventoryItem" ("item", "category", "location", "batch", "physicalQty", "reservedQty", "updatedAt")
         VALUES ($1, $2, $3, $4, 0, 0, NOW())
         ON CONFLICT ("item", "location", "batch") DO UPDATE SET "updatedAt" = NOW()`,
        transfer.item,
        "Transferred Category", // or copy from source. We'll find source category to make it clean
        transfer.destinationLocation,
        transfer.batch
      );

      const destInv = await tx.inventoryItem.findUnique({
        where: {
          item_location_batch: {
            item: transfer.item,
            location: transfer.destinationLocation,
            batch: transfer.batch
          }
        }
      });

      if (!destInv) {
        throw new Error("Failed to initialize destination inventory row");
      }

      // Try to find category from source item to keep it correct
      const sourceItemDetail = await tx.inventoryItem.findFirst({
        where: { item: transfer.item }
      });
      const category = sourceItemDetail?.category || "Unknown";

      // Update destination stock: add quantity to physicalQty
      await tx.inventoryItem.update({
        where: { id: destInv.id },
        data: {
          physicalQty: destInv.physicalQty + transfer.quantity,
          category // update category if it was initialized generically
        }
      });

      // Log stock movement
      await tx.stockLog.create({
        data: {
          item: transfer.item,
          location: transfer.destinationLocation,
          batch: transfer.batch,
          quantity: transfer.quantity,
          reservedChange: 0,
          type: "TRANSFER_RECEIPT",
          referenceId: `TR-${transfer.id}`
        }
      });

      // Update transfer status to RECEIVED
      return tx.internalTransfer.update({
        where: { id },
        data: { status: TransferStatus.RECEIVED },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, role: true }
          }
        }
      });
    });

    return res.json({ success: true, data: updatedTransfer });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
