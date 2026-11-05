import { submitResponse } from "@/lib/cases";
import { errorResponse, json, readJson } from "@/lib/errors";
import { hashedClientIp } from "@/lib/security";
import { statement } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJson(req);
    const result = await submitResponse(id, statement(body.statement), hashedClientIp(req));
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
