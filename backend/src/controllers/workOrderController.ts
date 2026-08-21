import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth";
import { WorkOrderStatus } from "@prisma/client";
import { z } from "zod";

const createWorkOrderSchema = z.object({
  location: z.string().min(1, "Location is required"),
  item: z.string().min(1, "Item is required"),
  requiredQty: z.number().int().positive("Required quantity must be a positive integer"),
  assignedUserId: z.number().int().positive("Assigned user is required"),
});

export async function createWorkOrder(req: AuthRequest, res: Response) {
  try {
    const parsed = createWorkOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const { location, item, requiredQty, assignedUserId } = parsed.data;

    // Check if assigned user exists
    const user = await prisma.user.findUnique({ where: { id: assignedUserId } });
    if (!user) {
      return res.status(400).json({ success: false, message: "Assigned user does not exist" });
    }

    // Calculate available quantity at location across all batches
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { item, location }
    });

    const totalAvailable = inventoryItems.reduce((sum, current) => {
      const avail = current.physicalQty - current.reservedQty;
      return sum + (avail > 0 ? avail : 0);
    }, 0);

    const shortageQty = Math.max(0, requiredQty - totalAvailable);

    const workOrder = await prisma.workOrder.create({
      data: {
        location,
        item,
        requiredQty,
        assignedUserId,
        status: WorkOrderStatus.ASSIGNED,
        shortageQty
      },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    return res.status(201).json({ success: true, data: workOrder });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getWorkOrders(req: AuthRequest, res: Response) {
  try {
    const workOrders = await prisma.workOrder.findMany({
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Proactively recalculate shortage dynamically to match current stock levels
    const updatedWorkOrders = await Promise.all(workOrders.map(async (wo) => {
      if (wo.status === WorkOrderStatus.COMPLETED) {
        return { ...wo, shortageQty: 0 };
      }
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: { item: wo.item, location: wo.location }
      });
      const totalAvailable = inventoryItems.reduce((sum, current) => {
        const avail = current.physicalQty - current.reservedQty;
        return sum + (avail > 0 ? avail : 0);
      }, 0);
      const shortageQty = Math.max(0, wo.requiredQty - totalAvailable);
      
      // If shortage changed, update in db (optional, but good for keeping DB in sync)
      if (wo.shortageQty !== shortageQty) {
        await prisma.workOrder.update({
          where: { id: wo.id },
          data: { shortageQty }
        });
        wo.shortageQty = shortageQty;
      }

      return wo;
    }));

    return res.json({ success: true, data: updatedWorkOrders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateWorkOrderStatus(req: AuthRequest, res: Response) {
  try {
    const id = parseInt(req.params.id as string);
    const { status } = req.body;

    if (!Object.values(WorkOrderStatus).includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const workOrder = await prisma.workOrder.findUnique({ where: { id } });
    if (!workOrder) {
      return res.status(404).json({ success: false, message: "Work order not found" });
    }

    if (workOrder.status === WorkOrderStatus.COMPLETED) {
      return res.status(400).json({ success: false, message: "Completed work orders cannot be modified" });
    }

    if (status === WorkOrderStatus.COMPLETED) {
      // Perform database transaction to check and deduct stock
      const result = await prisma.$transaction(async (tx) => {
        // Lock inventory rows for this item at this location
        await tx.$queryRawUnsafe(
          `SELECT * FROM "InventoryItem" WHERE "item" = $1 AND "location" = $2 FOR UPDATE`,
          workOrder.item,
          workOrder.location
        );

        const inventoryItems = await tx.inventoryItem.findMany({
          where: { item: workOrder.item, location: workOrder.location },
          orderBy: { batch: "asc" }
        });

        const totalAvailable = inventoryItems.reduce((sum, current) => {
          const avail = current.physicalQty - current.reservedQty;
          return sum + (avail > 0 ? avail : 0);
        }, 0);

        if (totalAvailable < workOrder.requiredQty) {
          throw new Error(`Cannot complete work order: material shortage exists. Available: ${totalAvailable}, Required: ${workOrder.requiredQty}`);
        }

        // Deduct required qty from available batches
        let remainingRequired = workOrder.requiredQty;
        for (const inv of inventoryItems) {
          if (remainingRequired <= 0) break;

          const available = inv.physicalQty - inv.reservedQty;
          if (available <= 0) continue;

          const deduct = Math.min(remainingRequired, available);

          await tx.inventoryItem.update({
            where: { id: inv.id },
            data: { physicalQty: inv.physicalQty - deduct }
          });

          await tx.stockLog.create({
            data: {
              item: inv.item,
              location: inv.location,
              batch: inv.batch,
              quantity: -deduct,
              reservedChange: 0,
              type: "WORK_ORDER_COMPLETED",
              referenceId: `WO-${workOrder.id}`
            }
          });

          remainingRequired -= deduct;
        }

        // Update work order
        const updatedWo = await tx.workOrder.update({
          where: { id },
          data: { status: WorkOrderStatus.COMPLETED, shortageQty: 0 },
          include: {
            assignedUser: {
              select: { id: true, name: true, email: true, role: true }
            }
          }
        });

        return updatedWo;
      });

      return res.json({ success: true, data: result });
    } else {
      // Just progress status to IN_PROGRESS
      const updatedWo = await prisma.workOrder.update({
        where: { id },
        data: { status },
        include: {
          assignedUser: {
            select: { id: true, name: true, email: true, role: true }
          }
        }
      });
      return res.json({ success: true, data: updatedWo });
    }
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
