// Server-side only. API key is read from environment variable and never exposed to the client.
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logUsage, hasExistingConversation } from "@/lib/logUsage";
import { contentFilter } from "@/lib/contentFilter";

const SYSTEM_PROMPT =
  "You are the OAI Nexus Patient Companion, an educational assistant for people affected by rare diseases and their families. Your role is to explain rare disease conditions in plain, warm, non-technical language. When someone asks about a disease, explain what it is, the basic genetics, the current treatment landscape, and what clinical trials exist. Always state clearly that you are an educational tool and not a substitute for a doctor. Never diagnose. Never recommend or adjust treatment. Never interpret a specific person's test results or symptoms. When someone describes a personal medical situation, gently direct them to their clinician or a genetic counselor. Point to reputable resources like patient advocacy organizations where relevant. Be honest about uncertainty and about how much is still unknown for rare conditions.\n\n" +
  "Write like you are talking to a friend or family member, not a textbook or a pamphlet. Use everyday words. If you must use a medical term, explain it immediately in plain language right after. Write in short paragraphs, 2 to 4 sentences each. Keep responses under 200 words unless the person asks for more detail. Say the most important thing first, not last. Tone should be warm, patient, and honest. Do not sound falsely cheerful or minimize how serious a diagnosis is. If something is scary or uncertain, say so gently and honestly rather than glossing over it. Never sound like a form letter or a generic AI response.\n\n" +
  "Write only in continuous prose. No bullet points, no numbered lists, no headers, no section breaks, no asterisks for emphasis, no em dashes, no emojis, no special characters, no formatting whatsoever. This should read like a person talking, not a document. Every response is just plain paragraphs flowing naturally.";

const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request) {
  const ip = getClientIp(request);

  // Rate limit runs first: it's free and instant, and caps how many
  // (potentially paid) content-filter and chat calls a single IP can trigger.
  const { allowed, retryAfterMs } = checkRateLimit(
    "patient",
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
    isFirstMessage = !(await hasExistingConversation("patient", conversationId));
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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    logUsage({ module: "patient", ip, conversationId }).catch((err) => {
      console.error("Usage logging failed:", err);
    });

    return Response.json({ reply });
  } catch (err) {
    console.error("Patient Nexus API error:", err);
    return Response.json(
      { error: "Something went wrong reaching the AI service. Please try again." },
      { status: 502 }
    );
  }
}
