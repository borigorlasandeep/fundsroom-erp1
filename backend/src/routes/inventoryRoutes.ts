import { Router } from "express";
import { getInventory, getInventoryLogs } from "../controllers/inventoryController";
import { requireAuth, requireRoles } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

router.get("/", requireAuth, getInventory);
router.get("/logs", requireAuth, requireRoles(Role.ADMIN, Role.OPERATIONS_USER), getInventoryLogs);

export default router;
