import { createCase } from "@/lib/cases";
import { errorResponse, json, readJson } from "@/lib/errors";
import { hashedClientIp } from "@/lib/security";
import { parseNewCase } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const input = parseNewCase(await readJson(req));
    const result = await createCase(input, hashedClientIp(req));
    return json(result, result.serious ? 200 : 201);
  } catch (err) {
    return errorResponse(err);
  }
}
