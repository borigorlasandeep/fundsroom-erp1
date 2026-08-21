import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { signToken } from "../utils/auth";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Valid email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  return res.json({
    success: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
}

export async function me(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, email: true, role: true }
  });
  res.json({ success: true, user });
}

export async function getUsers(req: AuthRequest, res: Response) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true }
    });
    return res.json({ success: true, data: users });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
