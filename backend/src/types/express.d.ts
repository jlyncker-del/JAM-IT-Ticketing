import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface User {
      id: string;
      role: UserRole;
      tokenVersion: number;
    }
    interface Request {
      user?: User;
    }
  }
}

export {};
