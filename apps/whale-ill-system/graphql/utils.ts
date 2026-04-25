import { GraphQLError } from "graphql";

export type WhaleContext = {
  isAdmin: boolean;
};

export function requireWhaleAdmin(ctx: WhaleContext): void {
  if (!ctx.isAdmin) {
    throw new GraphQLError("Unauthorized whale mutation");
  }
}

export function toNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toDateString(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
