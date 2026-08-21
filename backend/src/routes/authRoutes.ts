import { Router } from "express";
import { login, me, getUsers } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.post("/login", login);
router.get("/me", requireAuth, me);
router.get("/users", requireAuth, getUsers);

export default router;
