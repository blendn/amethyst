import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function notFound(_request: Request, response: Response): void {
  response
    .status(404)
    .json({ error: "not_found", message: "Resource not found." });
}

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "invalid_request",
      message: "Request validation failed.",
    });
    return;
  }

  if (error instanceof HttpError) {
    response
      .status(error.status)
      .json({ error: error.code, message: error.message });
    return;
  }

  console.error(
    "Unhandled API error",
    error instanceof Error ? error.message : "unknown",
  );
  response.status(500).json({
    error: "internal_error",
    message: "The request could not be completed.",
  });
}
