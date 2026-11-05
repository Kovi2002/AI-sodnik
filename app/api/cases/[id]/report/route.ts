import { reportCase } from "@/lib/cases";
import { errorResponse, json, readJson } from "@/lib/errors";
import { reportReason } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJson(req);
    await reportCase(id, reportReason(body.reason));
    return json({ reported: true });
  } catch (err) {
    return errorResponse(err);
  }
}
