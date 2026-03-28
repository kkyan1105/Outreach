// TODO: Person B — POST (register volunteer) + GET (list volunteers)
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ data: [], error: null });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ data: body, error: null });
}
