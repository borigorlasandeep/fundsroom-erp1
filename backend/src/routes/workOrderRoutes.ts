import { Router } from "express";
import { createWorkOrder, getWorkOrders, updateWorkOrderStatus } from "../controllers/workOrderController";
import { requireAuth, requireRoles } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

router.get("/", requireAuth, getWorkOrders);
router.post("/", requireAuth, requireRoles(Role.ADMIN), createWorkOrder);
router.patch("/:id/status", requireAuth, requireRoles(Role.ADMIN, Role.OPERATIONS_USER), updateWorkOrderStatus);

export default router;
