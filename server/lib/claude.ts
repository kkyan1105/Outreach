import OpenAI from "openai";
import { MATCHING_SYSTEM_PROMPT } from "./matching-prompt";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MatchInput {
  pending_requests: {
    request_id: string;
    senior_id: string;
    name: string;
    lat: number;
    lng: number;
    destination_type: string;
    preferred_date: string;
    time_window: string;
  }[];
  available_volunteers: {
    volunteer_id: string;
    name: string;
    lat: number;
    lng: number;
    max_passengers: number;
    availability: string[];
  }[];
  cluster_hints?: any[];
}

interface MatchOutput {
  groups: {
    senior_ids: string[];
    volunteer_id: string;
    suggested_time: string;
    destination_type: string;
    reasoning: string;
  }[];
  unmatched_seniors: string[];
  unmatched_reason: string;
}

export async function runMatching(input: MatchInput): Promise<MatchOutput> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    messages: [
      { role: "system", content: MATCHING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Here are the pending outing requests and available volunteers. Please group them optimally.\n\n${JSON.stringify(input, null, 2)}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content || "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("OpenAI did not return valid JSON");
  }

  return JSON.parse(jsonMatch[0]) as MatchOutput;
}
