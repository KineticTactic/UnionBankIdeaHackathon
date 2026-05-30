const router = require("express").Router();
const https = require("https");
const path = require("path");
const fs = require("fs");
const { verifyToken, requireRole } = require("../middleware/auth");
const dataStore = require("../services/dataStore");
const localData = require("../services/localData");
const config = require("../config");
const claudeService = require("../services/claudeService");

const AZURE_ENDPOINT =
  "https://kensara.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview";
const AZURE_KEY =
  "AdSYrEz8684XXXamBrr0CdulYytjligrRymiJmDZcVhiBeHKqYcvJQQJ99CEACYeBjFXJ3w3AAAAACOG8tvd";
const AZURE_MODEL = "DeepSeek-V4-Pro";

function loadV2Score(customerId) {
  try {
    const all = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../chronos/data/scores_v2.json"),
        "utf8",
      ),
    );
    return all.find((s) => s.customer_id === customerId) || null;
  } catch {
    return null;
  }
}

function loadActionPlan(customerId) {
  try {
    const all = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../chronos/data/action_plans.json"),
        "utf8",
      ),
    );
    return all.find((p) => p.customer_id === customerId) || null;
  } catch {
    return null;
  }
}

function loadCrmNotes(customerId) {
  try {
    const all = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../bank/data/crm_notes.json"),
        "utf8",
      ),
    );
    return all.filter((n) => n.customer_id === customerId);
  } catch {
    return [];
  }
}

function fmtDate(iso) {
  if (!iso) return "unknown date";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function buildOutreachPrompt(channel, customerData) {
  const {
    customer,
    engagement,
    active_signals,
    life_events,
    v2Score,
    accounts,
    crmNotes,
    actionPlan,
  } = customerData;

  const firstName = (customer.full_name || "Valued Customer").split(" ")[0];

  // === Verbatim CRM intelligence ===
  const complaints = crmNotes.filter((n) => n.note_type === "complaint");
  const unresolvedComplaints = complaints.filter((n) => n.resolved === false);
  const crmSection = crmNotes.length
    ? crmNotes
        .slice(0, 3)
        .map(
          (n) =>
            `  [${fmtDate(n.created_at)} · ${n.note_type} · ${n.channel}] "${n.note_text}" — resolved: ${n.resolved}`,
        )
        .join("\n")
    : "  None on record";

  // === Verbatim signal intelligence ===
  const signalSection = active_signals.length
    ? active_signals
        .map(
          (s) =>
            `  ${s.signal_type} | method: ${s.method_used} | CUSUM/stat: ${s.cusum_value ?? "N/A"} (threshold ${s.alarm_threshold ?? "N/A"}) | confidence: ${(s.confidence * 100).toFixed(0)}%\n  Evidence: ${(s.evidence || []).join("; ")}`,
        )
        .join("\n")
    : "  None active";

  // === Verbatim life event intelligence ===
  const lifeSection = life_events.length
    ? life_events
        .map(
          (e) =>
            `  ${e.event_type} | source: ${e.source} | confidence: ${(e.confidence * 100).toFixed(0)}% | risk adjustment: +${(e.risk_adjustment * 100).toFixed(0)}%\n  Evidence: ${(e.evidence || []).join("; ")}`,
        )
        .join("\n")
    : "  None detected";

  // === Account details ===
  const acctSection = (accounts || []).length
    ? accounts
        .map(
          (a) =>
            `  ${a.account_type} (${a.product_code}) — ₹${Number(a.balance || 0).toLocaleString("en-IN")} — status: ${a.status}`,
        )
        .join("\n")
    : "  N/A";

  // === Recommended offer from COMPASS ===
  const offerSection = actionPlan
    ? `  Code: ${actionPlan.offer_code}\n  Description: ${actionPlan.offer_description}\n  Value: ${actionPlan.offer_value}\n  Timing: ${actionPlan.timing}\n  Strategy: ${actionPlan.content_strategy}\n  Tone: ${(actionPlan.tone_modifiers || []).join(", ")}`
    : "  No specific offer — use general retention messaging";

  const survival7d = v2Score
    ? `${(v2Score.survival_7d * 100).toFixed(1)}%`
    : "N/A";
  const survival30d = v2Score
    ? `${(v2Score.survival_30d * 100).toFixed(1)}%`
    : "N/A";
  const lastLogin =
    engagement?.days_since_last_login != null
      ? `${engagement.days_since_last_login} days ago`
      : "unknown";

  const channelInstructions = {
    email: `Write a professional, empathetic retention email.
FORMAT:
- Line 1: "Subject: <subject line>" — specific, not generic, references the actual situation
- Blank line
- Opening paragraph: address the EXACT life event or signal by name (e.g., "following your recent visit to our branch regarding the probate process" or "after noticing a significant change in your account activity since October"). DO NOT be vague.
- Body: reference the SPECIFIC unresolved complaint by issue type and date. Mention the EXACT offer (offer_description, offer_value).
- Closing: clear CTA — invite them to call or email, name the RM channel
- Sign-off: "Your Relationship Manager, Union Bank"
- 180–240 words total. Be specific, not generic.`,

    sms: `Write a concise SMS. Max 160 characters.
- Start with first name
- Reference ONE specific thing: the exact complaint issue type OR the exact life event
- Include the exact offer value or action
- End with reply/call CTA
- No emojis`,

    in_app: `Write an in-app push notification.
- Line 1: "Title: <title>" — max 7 words, specific to situation
- Line 2: "Body: <body>" — max 35 words, mention specific offer value or exact issue
- Warm but direct — reference their actual situation not generic "we value you"`,
  };

  return `You are HERALD, Union Bank's AI retention message generator. You have access to the FULL intelligence brief below. Your job is to write a message that references SPECIFIC facts — exact complaint text, exact life event evidence, exact offer — not generic platitudes.

════════════════════════════════════════
CUSTOMER INTELLIGENCE BRIEF
════════════════════════════════════════
Full Name   : ${customer.full_name}
ID          : ${customer.customer_id}
Age         : ${customer.age} | ${customer.employment_type}
Segment     : ${customer.segment} | Tenure: ${customer.tenure_years} years
City        : ${customer.city} | Preferred channel: ${customer.preferred_channel}
Email opt-in: ${customer.email_opt_in} | SMS opt-in: ${customer.sms_opt_in} | Call opt-in: ${customer.call_opt_in}

── ACCOUNTS ──────────────────────────
${acctSection}

── CHRONOS v2 RISK ───────────────────
Churn probability : ${(customer.churn_score * 100).toFixed(1)}% (${customer.risk_tier.toUpperCase()})
DeepHit survival  : 7-day ${survival7d} | 30-day ${survival30d}
Urgency           : ${v2Score?.urgency_horizon ?? "N/A"} | Disagreement: ${v2Score?.ensemble_disagreement ?? "N/A"}

── DETECTED LIFE EVENTS ──────────────
${lifeSection}

── ACTIVE BOCPD / CUSUM SIGNALS ──────
${signalSection}

── CRM NOTES (verbatim) ──────────────
${crmSection}
Unresolved complaints: ${unresolvedComplaints.length}
${unresolvedComplaints.map((c) => `  → [${fmtDate(c.created_at)}] ${c.issue_category}: "${c.note_text}"`).join("\n")}

── APP ENGAGEMENT ────────────────────
Sessions (30d): ${engagement?.total_sessions_30d ?? "N/A"} | Last login: ${lastLogin}
Most used: ${engagement?.most_used_feature?.replace(/_/g, " ") ?? "N/A"}

── COMPASS RECOMMENDED OFFER ─────────
${offerSection}
════════════════════════════════════════

TASK: ${channelInstructions[channel] || channelInstructions.email}

STRICT RULES:
- Reference AT LEAST 2 specific facts from the brief (exact complaint issue, exact life event evidence, exact offer value, exact account type)
- NEVER use words: "churn", "risk score", "algorithm", "AI", "model", "system"
- NEVER be generic — "we value your business" alone is not acceptable
- The message must read as if a real RM wrote it after reviewing the actual file
- Output ONLY the message. No preamble, no "here is the email:", no commentary.`;
}

// POST /api/outreach/generate — streams SSE tokens from DeepSeek
router.post("/generate", verifyToken, async (req, res) => {
  const { customer_id, channel } = req.body;
  if (!customer_id || !channel) {
    return res.status(400).json({
      status: "error",
      message: "customer_id and channel are required",
    });
  }

  // Gather all data streams before calling LLM
  const detail = localData.getCustomerById(customer_id);
  if (!detail || !detail.data) {
    return res
      .status(404)
      .json({ status: "error", message: "Customer not found" });
  }

  const { customer, accounts, engagement, crm_summary } = detail.data;
  const active_signals = dataStore.SIGNALS.filter(
    (s) => s.customer_id === customer_id && s.detected,
  );
  const life_events = dataStore.LIFE_EVENTS.filter(
    (e) => e.customer_id === customer_id,
  );
  const v2Score = loadV2Score(customer_id);
  const actionPlan = loadActionPlan(customer_id);
  const crmNotes = loadCrmNotes(customer_id);

  const prompt = buildOutreachPrompt(channel, {
    customer,
    accounts,
    engagement,
    crm_summary,
    active_signals,
    life_events,
    v2Score,
    actionPlan,
    crmNotes,
  });

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const payload = JSON.stringify({
      model: AZURE_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      max_tokens: 600,
      temperature: 0.75,
    });

    const url = new URL(AZURE_ENDPOINT);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_KEY,
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const azureReq = https.request(options, (azureRes) => {
      let buffer = "";
      azureRes.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const raw = trimmed.slice(5).trim();
          if (raw === "[DONE]") {
            sendEvent({ type: "done" });
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(raw);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) sendEvent({ type: "token", content: token });
          } catch {}
        }
      });
      azureRes.on("end", () => {
        sendEvent({ type: "done" });
        res.end();
      });
      azureRes.on("error", (e) => {
        sendEvent({ type: "error", message: e.message });
        res.end();
      });
    });

    azureReq.on("error", (e) => {
      sendEvent({ type: "error", message: `Azure connection failed: ${e.message}` });
      res.end();
    });

    azureReq.write(payload);
    azureReq.end();
  } catch (err) {
    sendEvent({ type: "error", message: err.message });
    res.end();
  }
});

router.get("/", verifyToken, (req, res) => {
  const { outreachRecords } = dataStore;
  const {
    customer_id,
    campaign_id,
    channel,
    status,
    page = 1,
    limit = 20,
  } = req.query;

  let results = [...outreachRecords];

  if (customer_id) {
    results = results.filter((r) => r.customer_id === customer_id);
  }
  if (campaign_id) {
    results = results.filter((r) => r.campaign_id === campaign_id);
  }
  if (channel) {
    results = results.filter((r) => r.channel === channel);
  }
  if (status) {
    results = results.filter((r) => r.status === status);
  }

  const total = results.length;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const paginated = results.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  res.json({
    status: "ok",
    data: paginated,
    total,
    page: pageNum,
    limit: limitNum,
  });
});

router.post("/", verifyToken, requireRole("manager", "admin"), (req, res) => {
  const { customer_id, channel, message } = req.body;

  if (!customer_id || !channel) {
    return res.status(400).json({
      status: "error",
      message: "customer_id and channel are required",
    });
  }

  const { CHURN_SCORES, LIFE_EVENTS } = dataStore;
  const score = CHURN_SCORES[customer_id] || {
    churn_score: 0.5,
    risk_tier: "medium",
    reason_codes: [],
  };

  const record = dataStore.addOutreachRecord({
    customer_id,
    campaign_id: null,
    channel,
    risk_tier: score.risk_tier,
    life_events: LIFE_EVENTS.filter((e) => e.customer_id === customer_id).map(
      (e) => e.event_type,
    ),
    offer_code: `OFFER-MANUAL-${Math.floor(Math.random() * 1000)}`,
    content_version: "v1.0",
    status: "sent",
    holdout_group: false,
    body_preview: message || "Manual outreach initiated",
    dispatched_by: req.user.username,
  });

  res.json({
    status: "ok",
    data: record,
  });
});

router.get("/campaigns", verifyToken, (req, res) => {
  const { CAMPAIGNS, outreachRecords } = dataStore;

  const campaignsWithStats = CAMPAIGNS.map((campaign) => {
    const campaignRecords = outreachRecords.filter(
      (r) => r.campaign_id === campaign.campaign_id,
    );
    const sent = campaignRecords.length;
    const delivered = campaignRecords.filter((r) =>
      ["delivered", "opened", "clicked"].includes(r.status),
    ).length;
    const opened = campaignRecords.filter((r) =>
      ["opened", "clicked"].includes(r.status),
    ).length;
    const clicked = campaignRecords.filter(
      (r) => r.status === "clicked",
    ).length;

    const uplift = dataStore.UPLIFT_RESULTS.find(
      (u) => u.campaign_id === campaign.campaign_id,
    );

    return {
      ...campaign,
      stats: {
        sent,
        delivered,
        delivered_rate: sent ? Math.round((delivered / sent) * 100) : 0,
        opened,
        open_rate: delivered ? Math.round((opened / delivered) * 100) : 0,
        converted: clicked,
        conversion_rate: opened
          ? Math.round((clicked / opened) * 10000) / 10000
          : 0,
        uplift_pct: uplift ? Math.round(uplift.uplift_pct * 100) : 0,
      },
    };
  });

  res.json({
    status: "ok",
    data: campaignsWithStats,
  });
});

router.get("/campaigns/list", verifyToken, (req, res) => {
  const { CAMPAIGNS, outreachRecords } = dataStore;

  const campaignsWithStats = CAMPAIGNS.map((campaign) => {
    const campaignRecords = outreachRecords.filter(
      (r) => r.campaign_id === campaign.campaign_id,
    );
    const sent = campaignRecords.length;
    const delivered = campaignRecords.filter((r) =>
      ["delivered", "opened", "clicked"].includes(r.status),
    ).length;
    const opened = campaignRecords.filter((r) =>
      ["opened", "clicked"].includes(r.status),
    ).length;
    const clicked = campaignRecords.filter(
      (r) => r.status === "clicked",
    ).length;

    const uplift = dataStore.UPLIFT_RESULTS.find(
      (u) => u.campaign_id === campaign.campaign_id,
    );
    const treatmentRecords = campaignRecords.filter((r) => !r.holdout_group);
    const holdoutRecords = campaignRecords.filter((r) => r.holdout_group);
    const treatmentRetention =
      treatmentRecords.filter((r) => r.status !== "failed").length /
      (treatmentRecords.length || 1);
    const holdoutRetention =
      holdoutRecords.filter((r) => r.status !== "failed").length /
      (holdoutRecords.length || 1);

    return {
      ...campaign,
      stats: {
        sent,
        delivered,
        delivered_rate: sent ? Math.round((delivered / sent) * 100) : 0,
        opened,
        open_rate: delivered ? Math.round((opened / delivered) * 100) : 0,
        converted: clicked,
        conversion_rate: opened
          ? Math.round((clicked / opened) * 10000) / 10000
          : 0,
        uplift_pct: uplift
          ? Math.round(uplift.uplift_pct * 100)
          : Math.round((treatmentRetention - holdoutRetention) * 100),
      },
    };
  });

  res.json({
    status: "ok",
    data: campaignsWithStats,
  });
});

router.get("/:id", verifyToken, (req, res) => {
  const { outreachRecords } = dataStore;
  const record = outreachRecords.find(
    (r) => r.outreach_id === parseInt(req.params.id),
  );

  if (!record) {
    return res.status(404).json({
      status: "error",
      message: "Outreach record not found",
    });
  }

  res.json({
    status: "ok",
    data: record,
  });
});

module.exports = router;
