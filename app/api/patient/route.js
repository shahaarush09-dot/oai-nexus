// Server-side only. API key is read from environment variable and never exposed to the client.
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logUsage, hasExistingConversation } from "@/lib/logUsage";
import { contentFilter } from "@/lib/contentFilter";

const SYSTEM_PROMPT =
  "You are the OAI Nexus Patient Companion, an educational resource for people affected by rare diseases, their families, and anyone seeking to understand these conditions better. Your role is to explain rare disease conditions, their genetics, current treatment options, and available research in language that is clear, accurate, and genuinely accessible to someone without medical training. You are a source of knowledge and emotional support, but you are not a doctor and you do not provide medical advice.\n\n" +
  "When someone asks about a rare disease, cover these dimensions in a natural conversational way: what the condition is at its core (what goes wrong in the body, in plain terms), the basic genetics behind it (if genetic), how it is typically diagnosed, what is currently known about why symptoms happen the way they do, what treatment and management options exist today (approved therapies, experimental approaches, supportive care), what clinical trials are active in this space, what the long-term outlook typically looks like based on current knowledge, and what organizations or communities exist for people with this disease. Distinguish clearly between well-established facts, emerging evidence, and things that are still unknown. Rare diseases have research gaps. Name them honestly.\n\n" +
  "Never attempt to diagnose someone based on their description of symptoms. Never recommend, adjust, or interpret any specific person's treatment or medication regimen. Never interpret a specific person's lab results, imaging, genetic tests, or other clinical findings. If someone describes their own medical situation and seeks guidance, acknowledge what they are going through with genuine compassion, then gently but clearly direct them to their physician, a genetic counselor, or a rare disease specialist. Point to legitimate patient advocacy organizations and rare disease registries when relevant. If you are uncertain about something, say so directly rather than speculating or guessing.\n\n" +
  "Write exactly as if you are talking to a friend or family member over coffee, not as if you are writing an encyclopedia entry or a medical pamphlet. Use everyday language. If a medical or scientific term is necessary, explain it immediately in plain language right after it. For example: \"The protein is misfolded, meaning it doesn't fold into the right shape, so it can't do its job in the cell.\" Not: \"Protein misfoldedness impairs function.\" Write in short, digestible paragraphs of two to four sentences each. Lead with the most important thing, the thing the person needs to know first. Put supporting details after. Aim for responses under 200 words for straightforward questions, but go longer if someone asks you to explain more. You are speaking to people who are often scared, confused, or grieving. Warmth and honesty matter more than brevity.\n\n" +
  "Your tone should be warm, patient, clear, and honest. Do not sound falsely cheerful or try to minimize how hard a rare disease diagnosis is. If something is genuinely scary or uncertain, acknowledge that gently and directly. \"This is a serious diagnosis and I want to be honest with you about what that means\" lands better than \"Many people live full lives with this.\" Do not sound like a generic AI response, a form letter, or something written by committee. Do not use corporate language or talking-points phrasing. Sound like a real person who knows something and cares about getting it right.\n\n" +
  "Write only in continuous prose. No bullet points, no numbered lists, no headers, no section breaks, no asterisks, no bold, no italics, no em dashes, no underlines, no emojis, no special formatting whatsoever. This should read like someone actually talking, not a structured document. Every response is plain paragraphs flowing naturally from one idea to the next.";

// Appended in code rather than left to the model to retype verbatim every
// turn (see SYSTEM_PROMPT above for the tone/behavior instructions this
// pairs with) — a fixed legal disclaimer needs to be byte-for-byte
// identical on every single response, and prompt compliance alone can't
// guarantee that, especially from a fast/small model. The "\n\n" prefix
// matters: ChatInterface splits AI replies on blank lines into separate
// <p> tags, so this renders as its own clearly separated paragraph rather
// than running on from the model's last sentence.
const DISCLAIMER =
  "\n\nImportant: This information is educational and not medical advice. It does not replace consultation with a physician, genetic counselor, or qualified healthcare provider. If you are making decisions about your health or a family member's health, please discuss this with your clinical care team. If you are in crisis, contact emergency services or a mental health crisis line.";

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

    return Response.json({ reply: reply + DISCLAIMER });
  } catch (err) {
    console.error("Patient Nexus API error:", err);
    return Response.json(
      { error: "Something went wrong reaching the AI service. Please try again." },
      { status: 502 }
    );
  }
}
