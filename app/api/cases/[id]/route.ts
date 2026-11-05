import { deleteCase, getCaseView } from "@/lib/cases";
import { errorResponse, json } from "@/lib/errors";

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Context) {
  try {
    const { id } = await params;
    return json(await getCaseView(id, req.headers.get("x-case-key")));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: Context) {
  try {
    const { id } = await params;
    await deleteCase(id, req.headers.get("x-case-key"));
    return json({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
