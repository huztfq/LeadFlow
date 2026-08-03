import type { UIMessage } from "ai";
import { outreachPlanSchema, type OutreachPlan } from "@/lib/assistant-plan";

/** Pull a present_plan tool output from a single UI message, if it drafted one. */
export function extractPlanFromMessage(message: UIMessage): OutreachPlan | null {
  if (message.role !== "assistant" || !message.parts) return null;

  for (const part of message.parts) {
    const type = (part as { type?: string }).type ?? "";
    if (type !== "tool-present_plan" && type !== "dynamic-tool") continue;

    const typed = part as {
      type: string;
      toolName?: string;
      state?: string;
      output?: unknown;
      input?: unknown;
    };

    if (type === "dynamic-tool" && typed.toolName !== "present_plan") continue;
    if (typed.state && typed.state !== "output-available" && typed.state !== "result") {
      // Still accept input if output missing but state complete-ish
      if (!typed.output && !typed.input) continue;
    }

    const candidate = typed.output && typeof typed.output === "object" && "plan" in (typed.output as object)
      ? (typed.output as { plan: unknown }).plan
      : typed.output ?? typed.input;

    const parsed = outreachPlanSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  return null;
}

/** Pull the latest present_plan tool output from UI messages. */
export function extractLatestPlan(messages: UIMessage[]): OutreachPlan | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const plan = extractPlanFromMessage(messages[i]);
    if (plan) return plan;
  }
  return null;
}

export function getMessageText(message: UIMessage): string {
  if (!message.parts?.length) return "";
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}
