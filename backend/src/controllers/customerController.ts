import { Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth";

const customerSchema = z.object({
  name: z.string().min(2),
  mobile: z.string().min(7),
  email: z.string().email().optional().or(z.literal("")),
  businessName: z.string().min(2),
  gstNumber: z.string().optional(),
  type: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]),
  address: z.string().min(2),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).optional(),
  followUpDate: z.string().optional(),
  notes: z.string().optional()
});

export async function listCustomers(req: AuthRequest, res: Response) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const search = String(req.query.search || "");
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { businessName: { contains: search, mode: "insensitive" as const } },
          { mobile: { contains: search } }
        ]
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.customer.count({ where })
  ]);

  res.json({ success: true, items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function getCustomer(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { followUps: { orderBy: { createdAt: "desc" } } }
  });
  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
  res.json({ success: true, customer });
}

export async function createCustomer(req: AuthRequest, res: Response) {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid customer data" });

  const data = parsed.data;
  const customer = await prisma.customer.create({
    data: {
      ...data,
      email: data.email || null,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      createdById: req.user!.id
    }
  });
  res.status(201).json({ success: true, customer });
}

export async function updateCustomer(req: AuthRequest, res: Response) {
  const parsed = customerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid customer data" });

  const data = parsed.data;
  const customer = await prisma.customer.update({
    where: { id: Number(req.params.id) },
    data: {
      ...data,
      followUpDate: data.followUpDate === undefined ? undefined : data.followUpDate ? new Date(data.followUpDate) : null
    }
  });
  res.json({ success: true, customer });
}

export async function addFollowUp(req: AuthRequest, res: Response) {
  const schema = z.object({ note: z.string().min(1), followUpDate: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Follow-up note is required" });

  const followUp = await prisma.followUp.create({
    data: {
      customerId: Number(req.params.id),
      createdById: req.user!.id,
      note: parsed.data.note,
      followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null
    }
  });
  res.status(201).json({ success: true, followUp });
}
