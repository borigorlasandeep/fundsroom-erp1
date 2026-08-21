import { Router } from "express";
import { createOrder, getOrders, completeOrder, cancelOrder } from "../controllers/orderController";
import { requireAuth, requireRoles } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

router.get("/", requireAuth, requireRoles(Role.ADMIN, Role.SALES_USER, Role.OPERATIONS_USER), getOrders);
router.post("/", requireAuth, requireRoles(Role.ADMIN, Role.SALES_USER), createOrder);
router.patch("/:id/complete", requireAuth, requireRoles(Role.ADMIN, Role.SALES_USER), completeOrder);
router.patch("/:id/cancel", requireAuth, requireRoles(Role.ADMIN, Role.SALES_USER), cancelOrder);

export default router;
