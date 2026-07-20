import { KEYWORDS } from "./keywords";

const CLASSIFIER_SYSTEM_PROMPT =
  "You are a content filter for a rare disease education and research platform. Your sole job is to determine if an incoming message is about rare diseases, genetic conditions, medical treatments, clinical research, or related healthcare topics. Answer only with YES or NO. YES if the message is even tangentially about a rare disease, genetic condition, medical condition, medical treatment, clinical trial, research, or healthcare. NO if the message is spam, gibberish, completely off-topic, inappropriate, or unrelated to healthcare/rare diseases.";

export const OFF_TOPIC_MESSAGE =
  "This tool is for rare disease education and research. Please ask a question about rare diseases, treatments, genetic conditions, or clinical research.";

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const caseInsensitivePattern = new RegExp(
  `\\b(${KEYWORDS.filter((k) => !k.caseSensitive)
    .map((k) => escapeRegExp(k.term))
    .join("|")})\\b`,
  "gi"
);

const caseSensitivePattern = new RegExp(
  `\\b(${KEYWORDS.filter((k) => k.caseSensitive)
    .map((k) => escapeRegExp(k.term))
    .join("|")})\\b`,
  "g"
);

export function countKeywordMatches(message) {
  if (!message) return 0;
  const insensitiveMatches = message.match(caseInsensitivePattern) || [];
  const sensitiveMatches = message.match(caseSensitivePattern) || [];
  return insensitiveMatches.length + sensitiveMatches.length;
}

// Requires an already-constructed Anthropic client so process.env.ANTHROPIC_API_KEY
// is only ever read inside the three /api/ route files, per the project's key-handling rule.
export async function classifyWithClaude(anthropic, message) {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 5,
    system: CLASSIFIER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: message }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim()
    .toUpperCase();

  return text.startsWith("YES");
}

// Fail-open: if the classifier call itself errors (network issue, Anthropic
// outage), the message is let through rather than blocking a real user's
// question over a transient infra problem. The rate limiter and the main
// chat system prompt remain as additional layers regardless.
//
// isFirstMessage gates the whole filter: follow-ups in an established
// conversation ("explain more", "what about treatments") skip keyword and
// Claude checks entirely, since they were already screened at the start of
// the conversation and legitimate follow-ups often carry no keywords of
// their own.
export async function contentFilter(anthropic, message, isFirstMessage) {
  if (!isFirstMessage) {
    return { pass: true };
  }

  const count = countKeywordMatches(message);

  if (count >= 2) {
    return { pass: true };
  }

  try {
    const isOnTopic = await classifyWithClaude(anthropic, message);
    if (isOnTopic) {
      return { pass: true };
    }
    return { pass: false, reason: OFF_TOPIC_MESSAGE };
  } catch (err) {
    console.error("Content filter classification failed, failing open:", err);
    return { pass: true };
  }
}
