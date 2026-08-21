import { Router } from "express";
import { createTransfer, getTransfers, dispatchTransfer, receiveTransfer } from "../controllers/transferController";
import { requireAuth, requireRoles } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

router.get("/", requireAuth, requireRoles(Role.ADMIN, Role.OPERATIONS_USER), getTransfers);
router.post("/", requireAuth, requireRoles(Role.ADMIN, Role.OPERATIONS_USER), createTransfer);
router.patch("/:id/dispatch", requireAuth, requireRoles(Role.ADMIN, Role.OPERATIONS_USER), dispatchTransfer);
router.patch("/:id/receive", requireAuth, requireRoles(Role.ADMIN, Role.OPERATIONS_USER), receiveTransfer);

export default router;
