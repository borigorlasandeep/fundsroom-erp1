import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

const secret = process.env.JWT_SECRET || "development_secret";

export type JwtPayload = {
  id: number;
  email: string;
  role: Role;
};

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, secret, { expiresIn: "1d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, secret) as JwtPayload;
}
