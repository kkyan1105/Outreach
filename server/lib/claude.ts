import Anthropic from "@anthropic-ai/sdk";
import { MATCHING_SYSTEM_PROMPT } from "./matching-prompt";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: MATCHING_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here are the pending outing requests and available volunteers. Please group them optimally.\n\n${JSON.stringify(input, null, 2)}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude did not return valid JSON");
  }

  return JSON.parse(jsonMatch[0]) as MatchOutput;
}
