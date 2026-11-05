import { retryVerdict } from "@/lib/cases";
import { errorResponse, json } from "@/lib/errors";
import { hashedClientIp } from "@/lib/security";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return json(await retryVerdict(id, req.headers.get("x-case-key"), hashedClientIp(req)));
  } catch (err) {
    return errorResponse(err);
  }
}
