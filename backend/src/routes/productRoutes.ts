import { Router } from "express";
import { addStock, createProduct, listProducts, stockMovements, updateProduct } from "../controllers/productController";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();
router.use(requireAuth);
router.get("/", listProducts);
router.post("/", requireRoles("ADMIN", "WAREHOUSE"), createProduct);
router.put("/:id", requireRoles("ADMIN", "WAREHOUSE"), updateProduct);
router.post("/:id/stock", requireRoles("ADMIN", "WAREHOUSE"), addStock);
router.get("/:id/stock-movements", stockMovements);

export default router;
