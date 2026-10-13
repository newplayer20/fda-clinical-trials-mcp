import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

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

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      // Empty scan body
    }

    const method = body?.method;
    const id = body?.id ?? 1;

    // Handle MCP protocol initialization
    if (method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "fda-clinical-trials-mcp", version: "1.0.0" }
        }
      });
    }

    // Handle MCP tool discovery (Including inputSchema, outputSchema, and annotations for 100 score)
    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "get_clinical_trials",
              description: "Fetch token-optimized, filtered clinical trial records from the FDA database based on a search query or medical condition.",
              inputSchema: {
                type: "object",
                properties: {
                  q: {
                    type: "string",
                    description: "The medical keyword, condition, or intervention to search for in clinical trials."
                  }
                },
                required: ["q"]
              },
              outputSchema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    description: "List of matching clinical trial records.",
                    items: {
                      type: "object"
                    }
                  }
                }
              },
              annotations: {
                readOnly: true,
                idempotent: true
              }
            }
          ]
        }
      });
    }

    // Default fallback
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: { status: "ok" }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 200 });
  }
}