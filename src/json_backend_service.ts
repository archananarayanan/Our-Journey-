export interface JourneyEntry {
  timestamp: string;
  action: "add" | "lose";
  points: number;
  totalAfter: number;
}

export interface JourneyData {
  totalScore: number;
  lastCelebratedMilestone: number;
  next_target: number;
  log: JourneyEntry[];
}

const JSON_STORAGE_URL =
  "https://api.jsonstorage.net/v1/json/a0c4f827-3a93-47b7-b42f-b7e1f80de40c/2f03175b-7ae1-41c4-a84a-34fca13c7dd4";

function getApiKey(): string | null {
  const apiKey = import.meta.env.VITE_JSON_STORAGE_API_KEY?.trim();
  return apiKey ? apiKey : null;
}

function getJourneyUrl(): string | null {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return `${JSON_STORAGE_URL}?apiKey=${encodeURIComponent(apiKey)}`;
}

function isJourneyData(value: unknown): value is JourneyData {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<JourneyData>;
  return (
    typeof candidate.totalScore === "number" &&
    typeof candidate.lastCelebratedMilestone === "number" &&
    Array.isArray(candidate.log)
  );
}

export async function getCurrentScoreData(): Promise<JourneyData | null> {
  const url = getJourneyUrl();
  if (!url) return null;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch journey data: ${res.status}`);
  }

  const data = (await res.json()) as unknown;
  if (!isJourneyData(data)) {
    throw new Error("Received invalid journey data");
  }

  return data;
}

export async function updateJourney(data: JourneyData): Promise<boolean> {
  const url = getJourneyUrl();
  if (!url) {
    console.warn("[journey-sync] Skipping JSON backend upload: missing VITE_JSON_STORAGE_API_KEY.");
    return false;
  }

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const responseText = await res.text().catch(() => "");
      throw new Error(
        `Failed to update journey data: ${res.status}${responseText ? ` ${responseText}` : ""}`,
      );
    }

    console.info("[journey-sync] Successfully uploaded journey data to JSON backend.", {
      totalScore: data.totalScore,
      lastCelebratedMilestone: data.lastCelebratedMilestone,
      logEntries: data.log.length,
    });
    return true;
  } catch (error) {
    console.error("[journey-sync] Failed to upload journey data to JSON backend.", error);
    throw error;
  }
}
