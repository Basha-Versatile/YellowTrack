import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { dbConnect } from "./db";
import {
  AppError,
  ForbiddenError,
  UnauthorizedError,
} from "./errors";
import { error as errorResponse } from "./http";
import { getSessionFromRequest, Session } from "./auth/session";

export type RouteContext<TParams = Record<string, string>> = {
  params: Promise<TParams>;
};

type HandlerCtx<TParams> = {
  req: NextRequest;
  params: TParams;
  session: Session | null;
};

type HandlerOptions = {
  auth?: boolean;
  roles?: string[];
  connectDb?: boolean;
};

type Handler<TParams> = (ctx: HandlerCtx<TParams>) => Promise<NextResponse> | NextResponse;

function mapZodIssues(err: ZodError): string[] {
  return err.issues.map((i) => `${i.path.join(".") || "_"}: ${i.message}`);
}

function translateError(err: unknown): NextResponse {
  // Zod validation
  if (err instanceof ZodError) {
    return errorResponse("Validation failed", 400, mapZodIssues(err));
  }

  // App errors
  if (err instanceof AppError) {
    return errorResponse(err.message, err.statusCode, err.errors);
  }

  // Mongo duplicate key
  const anyErr = err as { code?: number | string; name?: string; message?: string };
  if (anyErr?.code === 11000) {
    return errorResponse("Duplicate entry", 409);
  }

  // Mongoose validation
  if (anyErr?.name === "ValidationError") {
    return errorResponse(anyErr.message || "Validation failed", 400);
  }
  if (anyErr?.name === "CastError") {
    return errorResponse("Invalid identifier", 400);
  }

  // Fallback
  console.error("[API_ERROR]", err);
  return errorResponse("Internal server error", 500);
}

export function withRoute<TParams = Record<string, string>>(
  handler: Handler<TParams>,
  opts: HandlerOptions = {},
) {
  const { auth = false, roles, connectDb = true } = opts;

  return async (
    req: NextRequest,
    context: RouteContext<TParams>,
  ): Promise<NextResponse> => {
    try {
      if (connectDb) await dbConnect();

      const params = (await context.params) ?? ({} as TParams);

      let session: Session | null = null;
      if (auth || (roles && roles.length > 0)) {
        session = await getSessionFromRequest(req);
        if (!session) throw new UnauthorizedError();
        if (roles && roles.length > 0 && !roles.includes(session.role)) {
          throw new ForbiddenError();
        }
      }

      return await handler({ req, params, session });
    } catch (err) {
      return translateError(err);
    }
  };
}

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Throws ZodError on failure (handled by withRoute → 400).
 */
export async function parseJson<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  const json = await req.json().catch(() => ({}));
  return schema.parse(json);
}

/**
 * Parse query string params into a Zod schema.
 */
export function parseQuery<T>(req: NextRequest, schema: ZodSchema<T>): T {
  const entries: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => (entries[k] = v));
  return schema.parse(entries);
}
