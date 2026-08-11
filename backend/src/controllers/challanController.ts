import { Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth";
import { generateChallanNumber } from "../utils/challan";

const itemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive()
});

const createSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  items: z.array(itemSchema).min(1),
  status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT")
});

export async function listChallans(req: AuthRequest, res: Response) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const status = req.query.status ? String(req.query.status) : undefined;
  const where = status ? { status: status as any } : {};

  const [items, total] = await Promise.all([
    prisma.challan.findMany({
      where,
      include: { customer: true, createdBy: { select: { name: true, role: true } }, items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.challan.count({ where })
  ]);

  res.json({ success: true, items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function getChallan(req: AuthRequest, res: Response) {
  const challan = await prisma.challan.findUnique({
    where: { id: Number(req.params.id) },
    include: { customer: true, createdBy: { select: { id: true, name: true, role: true } }, items: true }
  });
  if (!challan) return res.status(404).json({ success: false, message: "Challan not found" });
  res.json({ success: true, challan });
}

async function createConfirmedChallan(customerId: number, items: { productId: number; quantity: number }[], userId: number) {
  return prisma.$transaction(async tx => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw Object.assign(new Error("Customer not found"), { statusCode: 404 });

    const products = [];
    for (const item of items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) throw Object.assign(new Error(`Product ${item.productId} not found`), { statusCode: 404 });
      if (product.currentStock < item.quantity) {
        throw Object.assign(new Error(`Insufficient stock for ${product.name}. Available: ${product.currentStock}`), { statusCode: 400 });
      }
      products.push({ product, quantity: item.quantity });
    }

    const challan = await tx.challan.create({
      data: {
        challanNumber: await generateChallanNumber(),
        customerId,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        status: "CONFIRMED",
        createdById: userId,
        items: {
          create: products.map(({ product, quantity }) => ({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unitPrice: product.unitPrice,
            quantity
          }))
        }
      },
      include: { items: true }
    });

    for (const { product, quantity } of products) {
      await tx.product.update({
        where: { id: product.id },
        data: { currentStock: { decrement: quantity } }
      });
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity,
          type: "OUT",
          reason: `Sales challan ${challan.challanNumber}`,
          createdById: userId
        }
      });
    }

    return challan;
  });
}

export async function createChallan(req: AuthRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Customer and at least one valid item are required" });

  const { customerId, items, status } = parsed.data;

  if (status === "DRAFT") {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    const products = await prisma.product.findMany({ where: { id: { in: items.map(i => i.productId) } } });
    if (products.length !== items.length) return res.status(404).json({ success: false, message: "One or more products not found" });

    const challan = await prisma.challan.create({
      data: {
        challanNumber: await generateChallanNumber(),
        customerId,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        status: "DRAFT",
        createdById: req.user!.id,
        items: {
          create: items.map(item => {
            const product = products.find(p => p.id === item.productId)!;
            return {
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              unitPrice: product.unitPrice,
              quantity: item.quantity
            };
          })
        }
      },
      include: { items: true }
    });
    return res.status(201).json({ success: true, challan });
  }

  const challan = await createConfirmedChallan(customerId, items, req.user!.id);
  res.status(201).json({ success: true, challan });
}

export async function updateStatus(req: AuthRequest, res: Response) {
  const schema = z.object({ status: z.enum(["CONFIRMED", "CANCELLED"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid status" });

  const id = Number(req.params.id);
  const current = await prisma.challan.findUnique({ where: { id }, include: { items: true } });
  if (!current) return res.status(404).json({ success: false, message: "Challan not found" });

  if (current.status !== "DRAFT") {
    return res.status(400).json({ success: false, message: "Only draft challans can change status" });
  }

  if (parsed.data.status === "CANCELLED") {
    const challan = await prisma.challan.update({ where: { id }, data: { status: "CANCELLED" } });
    return res.json({ success: true, challan });
  }

  const challan = await createConfirmedChallan(
    current.customerId,
    current.items.map(item => ({ productId: item.productId, quantity: item.quantity })),
    req.user!.id
  );

  await prisma.challan.delete({ where: { id } });
  res.json({ success: true, challan });
}
