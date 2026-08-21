import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import workOrderRoutes from "./routes/workOrderRoutes";
import transferRoutes from "./routes/transferRoutes";
import orderRoutes from "./routes/orderRoutes";
import { errorHandler, notFound } from "./middleware/error";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ success: true, message: "Mini Operations ERP API is running" });
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, status: "healthy", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/work-orders", workOrderRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/orders", orderRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
