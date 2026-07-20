// Server-side only. API key is read from environment variable and never exposed to the client.
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logUsage } from "@/lib/logUsage";

const SYSTEM_PROMPT =
  "You are the OAI Nexus Orphan Drug Intelligence Evaluator. Given structured inputs about a rare disease therapeutic candidate, produce a rigorous, investor-grade assessment in continuous analytical prose. The report should include these sections in this order: Executive Summary, Scientific Assessment covering target validity and mechanism and scientific strengths and weaknesses and key risks, Clinical Development Outlook, Market and Epidemiology covering disease prevalence and diagnosed population and unmet need, Pricing and Reimbursement Considerations, Competitive Landscape, and Investment Perspective presenting the case for and against funding this asset. Be specific and analytical, not promotional. Flag missing or uncertain data rather than inventing it. Write in the tone of a health policy institute or biotech pipeline analyst. This is educational analysis only and does not constitute investment advice.\n\n" +
  "Write only in continuous analytical prose with clear section headers as the only structural element (just the header name on its own line, then the prose below). No bullet points anywhere, no asterisks, no emojis, no em dashes, no tables, no special characters, no formatting within the text itself. The entire report should read like a professional analyst wrote it for an institutional audience, not like a formatted document.";

const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

function formatFormAsPrompt(form) {
  const f = form || {};
  return `Evaluate the following rare disease therapeutic candidate based on the structured profile below. Produce the full report using the required section structure.

SCIENTIFIC PROFILE
Drug or therapy name: ${f.drugName || "Not provided"}
Developing company: ${f.company || "Not provided"}
Disease indication: ${f.indication || "Not provided"}
Target gene or protein: ${f.target || "Not provided"}
Mechanism of action: ${f.mechanism || "Not provided"}
Modality: ${f.modality || "Not provided"}
Current clinical phase: ${f.phase || "Not provided"}

CLINICAL DEVELOPMENT
Estimated trial size (patients): ${f.trialSize || "Not provided"}
Primary endpoint: ${f.primaryEndpoint || "Not provided"}
Patient population description: ${f.patientPopulation || "Not provided"}
Notable safety signals: ${f.safetySignals || "None reported"}
Summary of prior clinical results: ${f.priorResults || "None reported"}

MARKET AND ECONOMICS
Global disease prevalence: ${f.prevalence || "Not provided"}
Diagnosed population: ${f.diagnosedPopulation || "Not provided"}
Primary geography of market: ${f.geography || "Not provided"}
Current standard of care: ${f.standardOfCare || "Not provided"}
Main competing therapies: ${f.competingTherapies || "Not provided"}
Rough annual price assumption: ${f.priceAssumption || "Unknown"}

REGULATORY
FDA Orphan Drug Designation: ${f.fdaOrphan || "Unknown"}
FDA Fast Track: ${f.fdaFastTrack || "Unknown"}
FDA Breakthrough Therapy: ${f.fdaBreakthrough || "Unknown"}
EMA Orphan Designation: ${f.emaOrphan || "Unknown"}
Other regulatory notes: ${f.regulatoryNotes || "None"}`;
}

export async function POST(request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(
    "bio",
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

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    if (body?.mode === "chat") {
      const report = typeof body.report === "string" ? body.report : "";
      const messages = Array.isArray(body.messages) ? body.messages : [];

      if (messages.length === 0) {
        return Response.json({ error: "No message provided." }, { status: 400 });
      }

      const contextMessages = [
        {
          role: "user",
          content: `Here is the Orphan Drug Intelligence Report generated earlier. Use it as context for the questions that follow.\n\n${report}`,
        },
        {
          role: "assistant",
          content: "Understood. I have the report in context and I'm ready for follow-up questions about it.",
        },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: contextMessages,
      });

      const reply = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      const conversationId =
        typeof body?.conversationId === "string" && body.conversationId
          ? body.conversationId
          : crypto.randomUUID();

      logUsage({ module: "bio", ip, conversationId }).catch((err) => {
        console.error("Usage logging failed:", err);
      });

      return Response.json({ reply });
    }

    // Default mode: initial report generation
    const prompt = formatFormAsPrompt(body?.form);

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3072,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const report = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const conversationId =
      typeof body?.conversationId === "string" && body.conversationId
        ? body.conversationId
        : crypto.randomUUID();

    logUsage({ module: "bio", ip, conversationId }).catch((err) => {
      console.error("Usage logging failed:", err);
    });

    return Response.json({ report });
  } catch (err) {
    console.error("Nexus Diligence API error:", err);
    return Response.json(
      { error: "Something went wrong reaching the AI service. Please try again." },
      { status: 502 }
    );
  }
}
