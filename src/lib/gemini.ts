import { StyleProfile } from "../types";

export async function analyzeStyle(texts: string[]): Promise<StyleProfile> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to analyze style");
  }

  return response.json();
}

export async function humanizeText(text: string, profile: StyleProfile): Promise<string> {
  const response = await fetch("/api/humanize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, profile }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to humanize text");
  }

  const data = await response.json();
  return data.result;
}

