import { NextResponse } from "next/server";

// Handle GET requests to root
export async function GET() {
  return NextResponse.json({
    name: "fda-clinical-trials-mcp",
    status: "online",
    mcp_endpoint: "/api/v1/niche-data",
  });
}

// Handle POST requests to root (Smithery MCP Initialization Handshake)
export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      // Empty scan payload
    }

    // Check if Smithery sent a JSON-RPC request
    const id = body?.id ?? 1;

    return NextResponse.json({
      jsonrpc: "2.0",
      id: id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "fda-clinical-trials-mcp",
          version: "1.0.0",
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 200 });
  }
}