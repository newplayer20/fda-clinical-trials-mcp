import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

// GET Handler
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    let dbQuery = supabase.from("fda_records").select("*").limit(20);
    if (query) {
      dbQuery = dbQuery.ilike("title", `%${query}%`);
    }

    const { data, error } = await dbQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

// POST Handler (Required for MCP Handshake scanning)
export async function POST(request: Request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      // Empty or non-JSON body sent during scan
    }

    // Return basic MCP metadata initialization response
    return NextResponse.json({
      status: "ok",
      name: "fda-clinical-trials-mcp",
      version: "1.0.0",
      description: "Token-optimized FDA clinical trial data endpoint for AI agents."
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}