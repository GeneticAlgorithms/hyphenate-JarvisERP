#!/usr/bin/env node
/**
 * jarvis-erp-mcp-server: MCP (stdio) front end for JarvisERP's FastAPI backend.
 *
 * Lets an MCP client (Claude Desktop, Claude Code...) run the autonomous month-end close,
 * act as the human Controller (approve / reject / answer / challenge), and inspect evidence
 * and the hash-chained audit log. Every limit stays enforced by the backend.
 *
 * Env: JARVIS_API_URL (default http://127.0.0.1:8000), JARVIS_APPROVER (maya | dev, default maya).
 */
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import { API_BASE_URL } from "./api.js";
import { registerControllerTools } from "./tools/controller.js";
import { registerReadTools } from "./tools/read.js";
import { registerWorkflowTools } from "./tools/workflow.js";

const INSTRUCTIONS = `JarvisERP is an autonomous Staff Accountant for Afterglow Labs (a simulated touring company). It reconciles bank, PayPal and Ramp to the ledger and proposes entries; it cannot post anything a human hasn't approved, and that limit is enforced in code.

You act for the human user, who plays the Controller (Maya Chen). Start with jarvis_get_status. Typical flow: jarvis_run_step(close) -> jarvis_list_work_items(state=PROPOSED / NEEDS_INFO) -> jarvis_get_work_item -> present the decision to the user -> jarvis_approve_item / jarvis_reject_item / jarvis_answer_question with the user's decision.
Never approve, reject, answer or decide policies unless the user has made that call. Money is shown in USD; Dr is positive, Cr negative.`;

function createServer(): McpServer {
  const server = new McpServer({ name: "jarvis-erp-mcp-server", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  registerReadTools(server);
  registerWorkflowTools(server);
  registerControllerTools(server);

  server.registerPrompt(
    "jarvis_month_end_review",
    {
      title: "Month-end review with Jarvis",
      description: "Walk the user through the Controller's review: run the close if needed, then go through every proposal and question with them",
      argsSchema: z.object({
        focus: z.string().optional().describe("Optional focus, e.g. 'PayPal transfers' or 'accruals'")
      })
    },
    async ({ focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "I'm the Controller reviewing JarvisERP's month-end close. Call jarvis_get_status; if the close hasn't run, run jarvis_run_step " +
              "with step='close'. Then list PROPOSED and NEEDS_INFO items" +
              (focus ? `, focusing on ${focus}` : "") +
              ". Take them one at a time: open each with jarvis_get_work_item and give me a short brief (what it is, the proposed entry as a " +
              "Dr/Cr table, the key evidence, reviewer verdict, anything unusual). Then wait for my call: approve, reject with a reason, " +
              "answer, or challenge. Don't decide anything for me. Finish with the bank reconciliation and audit-chain verification."
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "jarvis_demo_walkthrough",
    {
      title: "JarvisERP demo walkthrough",
      description: "Run the CalHacks demo storyline end to end: the -$3,912.44 PayPal transfer, the challenge, the self-approval denial, October true-ups, and the score"
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Run the JarvisERP demo storyline with me, pausing after each beat:\n" +
              "1. jarvis_run_step connect, then onboard; summarize the policies it proposed.\n" +
              "2. jarvis_run_step close. Find the PAYPAL INST XFER -$3,912.44 item and explain Jarvis's split as a Dr/Cr table " +
              "(subset-sum, SOW cut-off to prepaid, ECB FX and the PayPal spread, vendor resolution, personal purchase).\n" +
              "3. Challenge it: \"Why not just expense it all like we always do with PayPal? It's under materiality.\" Show the defense.\n" +
              "4. Have Jarvis try to approve its own proposal with jarvis_attempt_self_approval and show the denied audit row.\n" +
              "5. Ask me whether to make the Controller decisions myself or run controller_persona.\n" +
              "6. Run october, then show the bank reconciliation, verify the audit chain, and show jarvis_get_score vs the rules baseline."
          }
        }
      ]
    })
  );

  return server;
}

serveStdio(createServer);
console.error(`jarvis-erp-mcp-server running on stdio (backend: ${API_BASE_URL})`);
