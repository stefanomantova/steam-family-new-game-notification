import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getProjectRoot } from "@/lib/paths";

export async function GET(_: Request, { params }: { params: { diffId: string } }) {
  const file = path.join(getProjectRoot(), "member-diffs.json");
  if (!existsSync(file)) return NextResponse.json({ error: "Diff not found." }, { status: 404 });
  const diffs = JSON.parse(await readFile(file, "utf8"));
  const diff = diffs[params.diffId];
  return diff ? NextResponse.json(diff) : NextResponse.json({ error: "Diff not found." }, { status: 404 });
}
