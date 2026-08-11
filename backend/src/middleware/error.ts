import { Request, Response, NextFunction } from "express";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: "Route not found" });
}

export function errorHandler(error: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(error);
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal server error"
  });
}
