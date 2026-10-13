import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const STUDIES_URL =
  "https://clinicaltrials.gov/api/v2/studies?pageSize=20&sort=LastUpdatePostDate:desc";

const SUMMARY_MAX_LENGTH = 250;

type ClinicalStudy = {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: {
        name?: string;
      };
    };
    statusModule?: {
      overallStatus?: string;
      lastUpdatePostDateStruct?: {
        date?: string;
      };
    };
    designModule?: {
      phases?: string[];
    };
    conditionsModule?: {
      conditions?: string[];
    };
    armsInterventionsModule?: {
      interventions?: Array<{
        name?: string;
      }>;
    };
    descriptionModule?: {
      briefSummary?: string;
    };
  };
};

type StudiesResponse = {
  studies?: ClinicalStudy[];
};

type FdaRecord = {
  id: string;
  title: string;
  entity_name: string;
  status: string;
  phase: string;
  conditions: string[];
  interventions: string[];
  summary: string;
  last_updated: string | null;
  record_type: "CLINICAL_TRIAL";
};

function singleLine(value: string | undefined): string {
  return (value ?? "").replace(/[\r\n]+/g, " ").replace(/[ \t]+/g, " ").trim();
}

function toRecord(study: ClinicalStudy): FdaRecord | null {
  const protocol = study.protocolSection;
  const nctId = protocol?.identificationModule?.nctId?.trim();
  if (!nctId) return null;

  const interventions: string[] = [];
  for (const intervention of protocol?.armsInterventionsModule?.interventions ?? []) {
    const name = intervention.name?.trim();
    if (name) interventions.push(name);
  }

  const conditions = (protocol?.conditionsModule?.conditions ?? [])
    .map((condition) => condition.trim())
    .filter(Boolean);

  return {
    id: nctId,
    title: protocol?.identificationModule?.briefTitle?.trim() || "",
    entity_name: protocol?.sponsorCollaboratorsModule?.leadSponsor?.name?.trim() || "",
    status: protocol?.statusModule?.overallStatus?.trim() || "",
    phase: protocol?.designModule?.phases?.[0] || "N/A",
    conditions,
    interventions,
    summary: singleLine(protocol?.descriptionModule?.briefSummary).slice(0, SUMMARY_MAX_LENGTH),
    last_updated: protocol?.statusModule?.lastUpdatePostDateStruct?.date ?? null,
    record_type: "CLINICAL_TRIAL",
  };
}

export async function ingestClinicalTrials(): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const response = await fetch(STUDIES_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`ClinicalTrials.gov request failed (${response.status})`);
  }

  const body = (await response.json()) as StudiesResponse;
  const studies = body.studies ?? [];
  console.log(`Fetched ${studies.length} studies from ClinicalTrials.gov`);

  const records: FdaRecord[] = [];
  for (const study of studies) {
    const record = toRecord(study);
    if (!record) {
      console.log("Skipped a study with no nctId");
      continue;
    }
    records.push(record);
  }

  if (records.length === 0) {
    console.log("Successfully ingested 0 clinical trial records.");
    return 0;
  }

  let data: { id: string }[] | null = null;
  try {
    const result = await supabase
      .from("fda_records")
      .upsert(records, { onConflict: "id" })
      .select("id");

    if (result.error) {
      throw result.error;
    }
    data = result.data;
  } catch (error) {
    const failure = error as { message?: string; cause?: unknown };
    console.error("Detailed Error:", error, {
      message: failure.message,
      cause: failure.cause,
    });
    throw error;
  }

  const ingested = data?.length ?? 0;
  console.log(`Successfully ingested ${ingested} clinical trial records into fda_records.`);
  return ingested;
}

function invokedAsScript(): boolean {
  const entry = process.argv[1]?.replace(/\\/g, "/");
  return Boolean(entry?.endsWith("/lib/scraper.ts") || entry?.endsWith("/lib/scraper.js"));
}

if (invokedAsScript()) {
  ingestClinicalTrials().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Ingestion failed";
    console.error(message);
    process.exitCode = 1;
  });
}
