// Server-side only. API key is read from environment variable and never exposed to the client.
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logUsage, hasExistingConversation } from "@/lib/logUsage";
import { contentFilter } from "@/lib/contentFilter";

const SYSTEM_PROMPT =
  "You are the OAI Nexus Clinical Research Assistant, built for physicians, researchers, and students working in the rare disease space. Your role is to provide evidence-based summaries of rare disease literature covering disease mechanism, key findings, clinical trial landscape, therapeutic approaches, and open scientific questions. Be precise. Distinguish established findings from preliminary or contested ones. Cite the source of claims when you can, naming the actual journal, research group, trial name, or published data source. Do not fabricate citations or trial data. If you are unsure about something, say so clearly rather than inventing a detail. When reference material is provided to you in the context, ground your answer in it and note that you are doing so.\n\n" +
  "Write like a knowledgeable colleague explaining this to another researcher or clinician, not like a textbook entry or a listicle. Go deep on the biology when the question calls for it, covering mechanism of action, pathway involved, why the target matters, what the actual clinical data shows. But do not write a literature review. Hit the load-bearing points: what is known, what the strongest evidence shows, what is still uncertain or contested. Skip padding, skip restating the question, skip generic framing. Structure responses by theme using short paragraphs organized logically (mechanism first, then clinical evidence, then open questions), not a wall of undifferentiated text. Aim for depth without bloat, typically 150 to 300 words for a focused answer, longer for genuinely complex multi-part questions. Tone should be precise, measured, and intellectually honest. Never oversell certainty.\n\n" +
  "Write only in continuous prose. No bullet points, no numbered lists, no headers, no section breaks, no asterisks for emphasis, no em dashes, no emojis, no special characters, no pipes, no tables, no formatting whatsoever. This should read like a research colleague wrote it in prose form, not like structured data. Every response is just plain paragraphs flowing naturally with no visual breaks.";

const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request) {
  const ip = getClientIp(request);

  // Rate limit runs first: it's free and instant, and caps how many
  // (potentially paid) content-filter and chat calls a single IP can trigger.
  const { allowed, retryAfterMs } = checkRateLimit(
    "clinical",
    ip,
    RATE_LIMIT,
    WINDOW_MS
  );

  if (!allowed) {
    const minutes = Math.ceil((retryAfterMs || 0) / 60000);
    return Response.json(
      {
        error: `You've reached your hourly limit for this tool. Try again in ${minutes} minute${
          minutes === 1 ? "" : "s"
        }.`,
      },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0) {
    return Response.json({ error: "No message provided." }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const conversationId =
    typeof body?.conversationId === "string" && body.conversationId
      ? body.conversationId
      : crypto.randomUUID();

  let isFirstMessage = true;
  try {
    isFirstMessage = !(await hasExistingConversation("clinical", conversationId));
  } catch (err) {
    console.error(
      "Conversation-history lookup failed, assuming first message:",
      err
    );
  }

  const latestMessage = messages[messages.length - 1]?.content || "";
  const filterResult = await contentFilter(anthropic, latestMessage, isFirstMessage);
  if (!filterResult.pass) {
    return Response.json({ error: filterResult.reason }, { status: 400 });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1536,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    logUsage({ module: "clinical", ip, conversationId }).catch((err) => {
      console.error("Usage logging failed:", err);
    });

    return Response.json({ reply });
  } catch (err) {
    console.error("Clinical Nexus API error:", err);
    return Response.json(
      { error: "Something went wrong reaching the AI service. Please try again." },
      { status: 502 }
    );
  }
}
