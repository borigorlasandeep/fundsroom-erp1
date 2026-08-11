import { Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth";

const productSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(2),
  category: z.string().min(2),
  unitPrice: z.coerce.number().nonnegative(),
  currentStock: z.coerce.number().int().nonnegative().optional(),
  minStockQty: z.coerce.number().int().nonnegative(),
  warehouse: z.string().min(2)
});

export async function listProducts(req: AuthRequest, res: Response) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const search = String(req.query.search || "");
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
          { category: { contains: search, mode: "insensitive" as const } }
        ]
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.product.count({ where })
  ]);

  res.json({ success: true, items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function createProduct(req: AuthRequest, res: Response) {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid product data" });

  const data = parsed.data;
  try {
    const product = await prisma.$transaction(async tx => {
      const product = await tx.product.create({
        data: {
          name: data.name,
          sku: data.sku,
          category: data.category,
          unitPrice: data.unitPrice,
          currentStock: data.currentStock || 0,
          minStockQty: data.minStockQty,
          warehouse: data.warehouse,
          createdById: req.user!.id
        }
      });

      if ((data.currentStock || 0) > 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            quantity: data.currentStock || 0,
            type: "IN",
            reason: "Opening stock",
            createdById: req.user!.id
          }
        });
      }
      return product;
    });
    res.status(201).json({ success: true, product });
  } catch (error: any) {
    if (error.code === "P2002") return res.status(409).json({ success: false, message: "SKU already exists" });
    throw error;
  }
}

export async function updateProduct(req: AuthRequest, res: Response) {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid product data" });

  const product = await prisma.product.update({
    where: { id: Number(req.params.id) },
    data: parsed.data
  });
  res.json({ success: true, product });
}

export async function addStock(req: AuthRequest, res: Response) {
  const schema = z.object({
    quantity: z.coerce.number().int().positive(),
    type: z.enum(["IN", "OUT"]),
    reason: z.string().min(2)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid stock movement" });

  const id = Number(req.params.id);
  const movement = await prisma.$transaction(async tx => {
    const product = await tx.product.findUnique({ where: { id } });
    if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });

    const nextStock = product.currentStock + (parsed.data.type === "IN" ? parsed.data.quantity : -parsed.data.quantity);
    if (nextStock < 0) throw Object.assign(new Error("Stock cannot go negative"), { statusCode: 400 });

    await tx.product.update({ where: { id }, data: { currentStock: nextStock } });
    return tx.stockMovement.create({
      data: { productId: id, quantity: parsed.data.quantity, type: parsed.data.type, reason: parsed.data.reason, createdById: req.user!.id }
    });
  });

  res.status(201).json({ success: true, movement });
}

export async function stockMovements(req: AuthRequest, res: Response) {
  const movements = await prisma.stockMovement.findMany({
    where: { productId: Number(req.params.id) },
    include: { createdBy: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ success: true, movements });
}
