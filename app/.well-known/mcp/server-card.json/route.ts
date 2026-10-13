import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    $schema: "https://smithery.ai/mcp-server-card.schema.json",
    name: "fda-clinical-trials-mcp",
    description: "Token-optimized FDA clinical trial data endpoint for AI agents.",
    version: "1.0.0",
    tools: [
      {
        name: "get_clinical_trials",
        description: "Fetch token-optimized clinical trial data from FDA / ClinicalTrials.gov",
        parameters: {
          type: "object",
          properties: {
            q: {
              type: "string",
              description: "Search keyword or medical condition",
            },
          },
          required: ["q"],
        },
      },
    ],
  });
}