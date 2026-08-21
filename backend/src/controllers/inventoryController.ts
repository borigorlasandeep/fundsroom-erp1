import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth";

export async function getInventory(req: AuthRequest, res: Response) {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: [
        { item: "asc" },
        { location: "asc" },
        { batch: "asc" }
      ]
    });

    // Add availableQty helper in the payload
    const formattedItems = items.map(item => ({
      ...item,
      availableQty: item.physicalQty - item.reservedQty
    }));

    return res.json({ success: true, data: formattedItems });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getInventoryLogs(req: AuthRequest, res: Response) {
  try {
    const logs = await prisma.stockLog.findMany({
      orderBy: { createdAt: "desc" }
    });
    return res.json({ success: true, data: logs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
