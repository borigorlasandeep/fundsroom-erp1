import { Router } from "express";
import { createChallan, getChallan, listChallans, updateStatus } from "../controllers/challanController";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();
router.use(requireAuth);
router.get("/", listChallans);
router.get("/:id", getChallan);
router.post("/", requireRoles("ADMIN", "SALES"), createChallan);
router.patch("/:id/status", requireRoles("ADMIN", "SALES"), updateStatus);

export default router;
