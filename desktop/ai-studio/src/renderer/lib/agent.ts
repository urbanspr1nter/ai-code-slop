/**
 * Agent mode constants — system prompt addendum and continuation prompts.
 */

export const AGENT_SYSTEM_ADDENDUM = `\n\nYou are in AGENT MODE. You MUST work autonomously to complete the user's task.

CRITICAL RULES:
- DO NOT just describe what you will do. Actually DO it.
- Use your available tools immediately when needed — do not ask for permission.
- Each response should contain REAL WORK — code, analysis, tool calls, results.
- When the ENTIRE task is fully complete with nothing left to do, end your final response with [DONE] on its own line.
- Do NOT output [DONE] until everything is truly finished.
- If you encounter an error, try to recover or find an alternative approach.

WORKFLOW:
1. First response: Brief plan (2-3 sentences max), then immediately start executing step 1.
2. Subsequent responses: Execute the next step. Show your work.
3. Final response: Summarize what was accomplished, then [DONE]`;

export const AGENT_CONTINUE_PROMPT = 'Continue with the next step.';

export const AGENT_NUDGE_PROMPT = 'You returned an empty response. Please provide your analysis, findings, or next action based on the tool results you received. Summarize what you found and continue working on the task.';

export const AGENT_DONE_MARKER = '[DONE]';

export const AGENT_MAX_EMPTY_RETRIES = 3;
