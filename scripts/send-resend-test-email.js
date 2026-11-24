/**
 * Standalone, isolated Resend verification script.
 * 
 * SAFETY PROPERTIES:
 * - Does NOT create or touch database records, orders, payments, or outbox jobs.
 * - Does NOT expose, print, or log RESEND_API_KEY.
 * - Reads RESEND_API_KEY from the environment (or .env.local if loaded).
 * - Sender is configured as: SEVOLF Digital <support@sevolf.shop>
 * - Reply-To is configured as: support@sevolf.shop
 * - Single recipient: suryanaikoti01@gmail.com
 * - Subject: "SEVOLF Digital – Email Delivery Test"
 * 
 * USAGE:
 * node scripts/send-resend-test-email.js
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// Optionally load .env.local if running in local environment without exported env vars
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvLocal();

async function runTest() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    console.error("FATAL: RESEND_API_KEY is not set in the environment.");
    console.error("Please ensure RESEND_API_KEY is configured before executing this test.");
    process.exit(1);
  }

  const sender = process.env.RESEND_FROM_EMAIL || "SEVOLF Digital <support@sevolf.shop>";
  const replyTo = "support@sevolf.shop";
  const recipient = "suryanaikoti01@gmail.com";
  const subject = "SEVOLF Digital – Email Delivery Test";

  console.log("Preparing isolated delivery test with configuration:");
  console.log(`- From: ${sender}`);
  console.log(`- Reply-To: ${replyTo}`);
  console.log(`- To: ${recipient}`);
  console.log(`- Subject: ${subject}`);
  console.log("- API Key: [CONFIGURED - REDACTED]");

  const payload = JSON.stringify({
    from: sender,
    reply_to: replyTo,
    to: recipient,
    subject: subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background: #FAF8F5; border: 1px solid #DDD8CD; border-radius: 4px; color: #292B27;">
        <div style="margin-bottom: 24px;">
          <h1 style="font-size: 22px; font-weight: normal; letter-spacing: 0.15em; text-transform: uppercase; margin: 0 0 8px 0; color: #292B27;">SEVOLF Digital</h1>
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #657052; margin: 0; font-weight: 600;">Production Infrastructure Verification</p>
        </div>
        <div style="background: #FFFFFF; border: 1px solid #DDD8CD; border-radius: 4px; padding: 24px; margin-bottom: 24px;">
          <h2 style="font-size: 16px; margin-top: 0; color: #292B27; font-weight: 600;">Email Delivery Verification Successful</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #77766E; margin: 0 0 16px 0;">
            This email confirms that the SEVOLF Digital production email infrastructure is correctly integrated with Resend.
          </p>
          <ul style="font-size: 13px; line-height: 1.8; color: #292B27; padding-left: 20px; margin: 0;">
            <li><strong>Verified Sender Domain:</strong> sevolf.shop</li>
            <li><strong>Official Sender Address:</strong> ${sender}</li>
            <li><strong>Configured Reply-To:</strong> ${replyTo}</li>
            <li><strong>Website:</strong> https://www.sevolf.shop</li>
          </ul>
        </div>
        <p style="font-size: 12px; color: #77766E; margin: 0;">
          Sent from SEVOLF Digital Infrastructure verification suite. No action is required.
        </p>
      </div>
    `,
  });

  const options = {
    hostname: "api.resend.com",
    port: 443,
    path: "/emails",
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            console.log("\n========================================");
            console.log("RESEND TEST EMAIL DISPATCHED SUCCESSFULLY");
            console.log(`HTTP Status: ${res.statusCode}`);
            console.log(`Resend Message ID: ${parsed.id}`);
            console.log("========================================\n");
            resolve(parsed);
          } catch (e) {
            console.log(`Dispatched with response: ${data}`);
            resolve({ raw: data });
          }
        } else {
          console.error(`\nResend API rejected dispatch (HTTP ${res.statusCode}):`);
          console.error(data);
          reject(new Error(`Resend HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", (e) => {
      console.error("\nNetwork error connecting to Resend API:", e.message);
      reject(e);
    });

    req.write(payload);
    req.end();
  });
}

// Only execute when run directly:
if (require.main === module) {
  runTest().catch(() => process.exit(1));
}

module.exports = { runTest };
