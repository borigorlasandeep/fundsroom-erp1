import { Router } from "express";
import { addFollowUp, createCustomer, getCustomer, listCustomers, updateCustomer } from "../controllers/customerController";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();
router.use(requireAuth);
router.get("/", listCustomers);
router.get("/:id", getCustomer);
router.post("/", requireRoles("ADMIN", "SALES"), createCustomer);
router.put("/:id", requireRoles("ADMIN", "SALES"), updateCustomer);
router.post("/:id/follow-ups", requireRoles("ADMIN", "SALES"), addFollowUp);

export default router;
