// Server-side only. API key is read from environment variable and never exposed to the client.
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logUsage } from "@/lib/logUsage";
import { buildScenarios } from "@/lib/financialCalculations";

// Report generation with web search + a 9-section analysis, plus an
// occasional continuation call (see generateFullReport below), can still run
// long. Vercel's default serverless function timeout (10-60s on Hobby) will
// kill this well before it completes — this route needs a plan that supports
// a longer maxDuration (Pro, or Hobby with Fluid Compute).
export const maxDuration = 480;

const REPORT_MODEL = "claude-haiku-4-5-20251001";
const CHAT_MODEL = "claude-haiku-4-5-20251001";

// Haiku responds better to lean, direct instruction than to verbose
// guidance — this prompt is intentionally tight, with pre-calculated
// financials doing the heavy lifting so the model focuses on narrative and
// strategy rather than restating numbers or doing arithmetic.
const REPORT_SYSTEM_PROMPT =
  "You are the OAI Nexus Orphan Drug Intelligence Evaluator.\n\n" +
  "Produce continuous analytical prose with exactly these section headers, each on its own line, in this order: Executive Summary; Scientific Assessment; Clinical Development & Regulatory Pathway; Market Sizing & Competitive Analysis; Commercialization Strategy; Financial Scenarios; Investment Recommendation; Comparable Assets; Critical Caveats. Pace yourself so all nine sections are written in full — a report that stops before Critical Caveats is incomplete.\n\n" +
  "Executive Summary: one paragraph. What the asset is, the opportunity, the key risk, and the BASE case expected value, with specific numbers.\n\n" +
  "Scientific Assessment: target validity, mechanism, strengths, weaknesses, key risks, grounded in disease biology. Two to three paragraphs.\n\n" +
  "Clinical Development & Regulatory Pathway: current phase, trial timeline, approval probability, regulatory path (505(b)(2), NDA, BLA, etc.), label implications, what approval would actually look like. Distinguish fact from assumption. Two to three paragraphs.\n\n" +
  "Market Sizing & Competitive Analysis: addressable patient population, current approved therapies and pipeline, where this asset ranks, market share estimate at peak, competitive positioning. Two to three paragraphs.\n\n" +
  "Commercialization Strategy: sales approach, patient access, payer strategy, launch sequencing, key barriers and how to overcome them. Two to three paragraphs.\n\n" +
  "Financial Scenarios: narrative summary of the BASE, BULL, and BEAR cases. If pre-calculated figures are provided under PRE-CALCULATED FINANCIAL SCENARIOS, treat them as authoritative and reference them exactly rather than recomputing; otherwise estimate them yourself and flag them explicitly as estimates. Explain what drives each scenario. Two to three paragraphs.\n\n" +
  "Investment Recommendation: STRONG BUY, BUY, HOLD, or PASS, with rationale referencing regulatory, commercial, technical, and financial risk. One paragraph.\n\n" +
  "Comparable Assets: one to two real, specific comparable approved drugs or programs you are reasonably confident in — approval path, peak sales, competitive positioning. One to two paragraphs.\n\n" +
  "Critical Caveats: what is not known — trial outcomes, competitive moves, reimbursement decisions, market adoption. One paragraph.\n\n" +
  "Tone: analytical, evidence-based, specific with numbers, not promotional. Distinguish fact from assumption. Educational analysis only, not investment advice. Continuous prose only — no bullet points, no asterisks, no emojis, no em dashes, no tables, no special characters.\n\n" +
  "Research the disease, competitive landscape, and regulatory precedent independently rather than restating user inputs. Never fabricate a comparable-drug figure, trial result, or regulatory precedent you are not reasonably confident in — say a reliable figure isn't available instead.";

// Deliberately shorter and cheaper than the report prompt: follow-up
// questions don't need the full report structure re-derived, just a
// focused analytical answer referencing what's already in the report.
const FOLLOWUP_SYSTEM_PROMPT =
  "You are the OAI Nexus Orphan Drug Intelligence Evaluator, answering a follow-up question about a report you already generated (provided as context). Answer analytically and specifically, referencing the report's own numbers and reasoning rather than restating the whole report. If the question requires recalculating a scenario, do the math and show the result. Flag explicitly when you are estimating versus citing a figure already established in the report. Never fabricate a specific citation or comparable-drug figure you are not reasonably confident in — say so instead.\n\n" +
  "Keep the answer focused: 2 to 5 paragraphs unless the user explicitly asks for more detail. Write in continuous prose, no bullet points, no asterisks, no emojis, no em dashes, no tables. This is educational analysis only and does not constitute investment advice.";

const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

const CONTINUE_INSTRUCTION =
  "Continue exactly where you left off and finish the remaining sections in full, in the same order and depth as before. Do not repeat any section you already wrote, and do not restart from Executive Summary.";

// A 9-section report can still occasionally exceed one max_tokens budget
// (web search results and earlier sections eat into it unpredictably run to
// run). Rather than raise the ceiling, detect a truncated response
// (stop_reason "max_tokens") and continue generation in a follow-up call
// with a fresh budget, so the report is always complete regardless of how
// much the first pass used. Capped at 2 extra calls so a pathological case
// can't loop indefinitely.
async function generateFullReport(anthropic, prompt) {
  const messages = [{ role: "user", content: prompt }];
  let response = await anthropic.messages.create({
    model: REPORT_MODEL,
    max_tokens: 8500,
    system: REPORT_SYSTEM_PROMPT,
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: 1,
        allowed_callers: ["direct"],
      },
    ],
    messages,
  });

  let fullText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  let attempts = 0;
  while (response.stop_reason === "max_tokens" && attempts < 2) {
    attempts++;
    console.warn(`Nexus Diligence report hit max_tokens, continuing (attempt ${attempts}).`);
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: CONTINUE_INSTRUCTION });

    response = await anthropic.messages.create({
      model: REPORT_MODEL,
      max_tokens: 8500,
      system: REPORT_SYSTEM_PROMPT,
      messages,
    });

    const continuation = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    fullText += "\n\n" + continuation;
  }

  return fullText;
}

function list(value, fallback = "None selected") {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : fallback;
  }
  return value || fallback;
}

function formatFormAsPrompt(form, scenarios) {
  const f = form || {};

  const assetDetails = `DRUG/ASSET DETAILS:
Drug or therapy name: ${f.drugName || "Not provided"}
Developing company: ${f.company || "Not provided"}
Disease indication: ${f.indication || "Not provided"}
Target gene or protein: ${f.target || "Not provided"}
Mechanism of action: ${f.mechanism || "Not provided"}
Modality: ${f.modality || "Not provided"}
Current clinical phase: ${f.phase || "Not provided"}
Estimated trial size (patients): ${f.trialSize || "Not provided"}
Primary endpoint: ${f.primaryEndpoint || "Not provided"}
Patient population description: ${f.patientPopulation || "Not provided"}
Notable safety signals: ${f.safetySignals || "None reported"}
Summary of prior clinical results: ${f.priorResults || "None reported"}
Global disease prevalence: ${f.prevalence || "Not provided"}
Diagnosed population: ${f.diagnosedPopulation || "Not provided"}
Primary geography of market: ${f.geography || "Not provided"}
Current standard of care: ${f.standardOfCare || "Not provided"}
Main competing therapies: ${f.competingTherapies || "Not provided"}
Rough annual price assumption: ${f.priceAssumption || "Unknown"}
FDA Orphan Drug Designation: ${f.fdaOrphan || "Unknown"}
FDA Fast Track: ${f.fdaFastTrack || "Unknown"}
FDA Breakthrough Therapy: ${f.fdaBreakthrough || "Unknown"}
EMA Orphan Designation: ${f.emaOrphan || "Unknown"}
Other regulatory notes: ${f.regulatoryNotes || "None"}`;

  const commercialContext = `COMMERCIAL & MARKET CONTEXT:
Existing sales force: ${f.salesForceStatus || "Not provided"}
If partnering, regions/markets: ${f.partneringRegions || "Not provided"}
Sales force size estimate: ${f.salesForceSize || "Not provided"} reps
Planned launch regions: ${list(f.launchRegions)}
Patient identification method: ${f.patientIdentification || "Not provided"}
Patient registry exists: ${f.patientRegistry || "Not provided"}
Estimated time to reach 50% of addressable market: ${f.timeToHalfMarket || "Not provided"} years
Key barriers to patient access: ${list(f.accessBarriers)}
Primary payers: ${list(f.primaryPayers)}
Estimated commercial coverage likelihood: ${f.commercialCoverageLikelihood || "Not provided"}%
Estimated patient copay once approved: $${f.estimatedCopay || "Not provided"} per month
Reimbursement precedent exists: ${f.reimbursementPrecedent || "Not provided"}
Years from now to regulatory approval: ${f.yearsToApproval || "Not provided"}
Years from approval to peak sales: ${f.yearsApprovalToPeak || "Not provided"}
Expected peak annual sales (rough estimate): ${f.expectedPeakSales ? `$${f.expectedPeakSales}M` : "Not provided"}
Approved competitors for this indication: ${f.approvedCompetitorsCount || "Not provided"}
Pipeline competitors: ${f.pipelineCompetitorsCount || "Not provided"}
Estimated peak market share: ${f.peakMarketShare || "Not provided"}%
Key competitive advantage: ${f.competitiveAdvantage || "Not provided"}
Current standard of care level: ${f.standardOfCareLevel || "Not provided"}
Key unmet need: ${f.unmetNeed || "Not provided"}
Differentiation: ${f.differentiation || "Not provided"}
Patient preference driver: ${f.patientPreference || "Not provided"}`;

  const strategicAssumptions = `STRATEGIC ASSUMPTIONS:
Peak annual sales (user estimate): ${f.basePeakSales ? `$${f.basePeakSales}M` : "Not provided"}
Net profit margin: ${f.netProfitMargin || "Not provided"}%
Probability of regulatory approval: ${f.approvalProbability || "Not provided"}%
Probability of commercial success post-approval: ${f.commercialSuccessProbability || "Not provided"}%
Discount rate for NPV: ${f.discountRate || "10 (default)"}%
Biggest value driver: ${f.biggestValueDriver || "Not provided"}
Biggest risk to value: ${f.biggestRisk || "Not provided"}
Event that could kill the deal: ${f.dealKillerEvent || "Not provided"}
Event that could double the value: ${f.valueDoublingEvent || "Not provided"}
Comparable assets to benchmark against: ${f.comparableAssets || "Not provided"}
Comparable asset peak annual sales: ${f.comparablePeakSales ? `$${f.comparablePeakSales}M` : "Not provided"}`;

  const scenarioBlock = scenarios
    ? `PRE-CALCULATED FINANCIAL SCENARIOS (authoritative — reference these exactly, do not recompute):
BASE: approval probability ${scenarios.base.approvalProbability.toFixed(0)}%, peak sales $${scenarios.base.peakSales.toFixed(0)}M, commercial probability ${scenarios.base.commercialProbability.toFixed(0)}%, NPV $${scenarios.base.npv.toFixed(0)}M, Expected Value $${scenarios.base.ev.toFixed(0)}M, time to peak ${scenarios.base.timeToPeak.toFixed(1)} years, margin at peak ${scenarios.base.marginAtPeak.toFixed(0)}%.
BULL: approval probability ${scenarios.bull.approvalProbability.toFixed(0)}%, peak sales $${scenarios.bull.peakSales.toFixed(0)}M, commercial probability ${scenarios.bull.commercialProbability.toFixed(0)}%, NPV $${scenarios.bull.npv.toFixed(0)}M, Expected Value $${scenarios.bull.ev.toFixed(0)}M, time to peak ${scenarios.bull.timeToPeak.toFixed(1)} years, margin at peak ${scenarios.bull.marginAtPeak.toFixed(0)}%.
BEAR: approval probability ${scenarios.bear.approvalProbability.toFixed(0)}%, peak sales $${scenarios.bear.peakSales.toFixed(0)}M, commercial probability ${scenarios.bear.commercialProbability.toFixed(0)}%, NPV $${scenarios.bear.npv.toFixed(0)}M, Expected Value $${scenarios.bear.ev.toFixed(0)}M, time to peak ${scenarios.bear.timeToPeak.toFixed(1)} years, margin at peak ${scenarios.bear.marginAtPeak.toFixed(0)}%.`
    : `PRE-CALCULATED FINANCIAL SCENARIOS: Not available — the user did not provide enough numeric data (peak sales, margin, approval probability, commercial probability, and timeline are all required) for deterministic modeling. Estimate reasonable BEAR/BASE/BULL figures yourself from the disease and drug profile, and flag every figure explicitly as your own estimate, not a calculated or user-provided figure.`;

  const instructions = `INSTRUCTIONS:
Research ${f.indication || "this disease"} and ${f.drugName || "this drug"} using what you reliably know and, where helpful, web search. Provide the strategic analysis covering: market sizing with geographic breakdown; commercialization strategy; regulatory pathway analysis and approval probability; competitive landscape assessment; three-scenario financial modeling (BEAR/BASE/BULL); Expected Value; and an investment recommendation. Use precedent from comparable drugs and disease epidemiology to inform your analysis. Go deep — do not just restate what the user provided. Make strategic recommendations on how to optimize commercialization, payer access, and commercial probability.`;

  return [assetDetails, commercialContext, strategicAssumptions, scenarioBlock, instructions].join(
    "\n\n"
  );
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
        model: CHAT_MODEL,
        max_tokens: 1500,
        system: FOLLOWUP_SYSTEM_PROMPT,
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
    const scenarios = buildScenarios(body?.form || {});
    const prompt = formatFormAsPrompt(body?.form, scenarios);

    const report = await generateFullReport(anthropic, prompt);

    const conversationId =
      typeof body?.conversationId === "string" && body.conversationId
        ? body.conversationId
        : crypto.randomUUID();

    logUsage({ module: "bio", ip, conversationId }).catch((err) => {
      console.error("Usage logging failed:", err);
    });

    return Response.json({ report, scenarios });
  } catch (err) {
    console.error("Nexus Diligence API error:", err);
    return Response.json(
      { error: "Something went wrong reaching the AI service. Please try again." },
      { status: 502 }
    );
  }
}
