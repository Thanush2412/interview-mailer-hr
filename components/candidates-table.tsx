"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2, Send, RefreshCw, ChevronLeft, ChevronRight,
  Columns3, Mail, CheckSquare, User,
} from "lucide-react";

import { ColumnMapping } from "@/components/column-mapper";

type Candidate = Record<string, string | number> & { _rowIndex: number };

interface SheetResponse {
  status: string;
  headers: string[];
  data: Candidate[];
  message?: string;
}

// ── field helpers ──────────────────────────────────────────────────────────────
// If a column mapping is provided, use it directly. Otherwise fall back to
// fuzzy header matching so the app works even without explicit mapping.

function findHeader(headers: string[], keys: string[]): string | undefined {
  for (const key of keys) {
    const match = headers.find((h) => h.toLowerCase().trim() === key.toLowerCase().trim());
    if (match) return match;
  }
}

function getField(row: Candidate, headers: string[], keys: string[]) {
  const h = findHeader(headers, keys);
  return h ? String(row[h] ?? "") : "";
}

function getMapped(row: Candidate, mappedCol: string | undefined, fallbackKeys: string[], headers: string[]) {
  if (mappedCol) return String(row[mappedCol] ?? "");
  return getField(row, headers, fallbackKeys);
}

// Curried helpers — accept mapping as first arg
const mkGet = (mappingKey: keyof ColumnMapping, fallback: string[]) =>
  (r: Candidate, h: string[], m: ColumnMapping) => getMapped(r, m[mappingKey], fallback, h);

const getEmail = mkGet("email", ["candidate mail id", "mail id", "to", "email", "recipient", "email id", "email address", "to email", "candidate email"]);
const getName = mkGet("name", ["candidate name", "name", "full name", "candidate", "candidate_name"]);
const getId = mkGet("candidateId", ["candidate id", "candidateid", "id", "candidate_id", "roll no", "roll number"]);
const getType = mkGet("interviewType", ["mode of interview", "interview type", "type", "mode", "interview mode", "mode_of_interview"]);
const getDate = mkGet("date", ["interview scheduled date", "interview date", "date", "scheduled date", "interview_date"]);
const getTime = mkGet("time", ["time", "interview time", "scheduled time", "reporting time", "interview_time"]);
const getLink = mkGet("meetingLink", ["meeting link", "link", "meet link", "zoom link", "teams link", "interview link", "google meet"]);
const getJob = mkGet("jobTitle", ["role interviewed for", "name of the role", "job title", "position", "role", "designation", "job_title"]);
const getEvaluator = mkGet("evaluatorName", ["interview evaluator", "evaluator", "interviewer", "interviewer name", "evaluator name", "panel member", "panel member name"]);
const getPanelDesignation = mkGet("panelDesignation", ["panel member designation", "evaluator designation", "interviewer designation", "designation", "panel designation"]);
const getPanelLinkedin = mkGet("panelLinkedin", ["panel member linkedin", "evaluator linkedin", "interviewer linkedin", "linkedin profile", "linkedin", "panel linkedin"]);
const getEvaluatorEmail = mkGet("evaluatorEmail", ["interviewer email", "evaluator email", "interviewer mail", "evaluator mail"]);
const getResumeUrl = mkGet("resumeUrl", ["resume", "resume url", "resume link", "cv", "cv link", "cv url"]);
const getEmailStatus = (r: Candidate, h: string[], m: ColumnMapping) =>
  getMapped(r, m["emailStatus"], ["email status", "mail sent status", "status"], h);

// ── email templates ────────────────────────────────────────────────────────────
export interface PanelMemberOverride {
  name: string;
  designation?: string;
  linkedin?: string;
}

export type Template = { subject: string; body: string; htmlBody: string; candidateId: string };

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderPanelCardHtml(panelName: string, panelDesignation?: string, panelLinkedin?: string): string {
  if (!panelName) return "";
  const linkedInBtn = panelLinkedin ? `
    <div style="margin-top:10px;">
      <a href="${escapeHtml(panelLinkedin)}" target="_blank" style="display:inline-flex;align-items:center;background:#0A66C2;color:#ffffff;text-decoration:none;font-size:11px;font-weight:bold;padding:5px 12px;border-radius:3px;font-family:Verdana,Geneva,sans-serif;">
        View LinkedIn Profile &rarr;
      </a>
    </div>` : "";

  return `
  <div style="margin-bottom:28px;">
    <p style="margin:0 0 6px;font-size:15px;font-weight:bold;color:#1E293B;font-family:Verdana,Geneva,sans-serif;">
      👥 Meet the People You’ll Be Talking To
    </p>
    <p style="margin:0 0 14px;font-size:13px;color:#64748B;font-family:Verdana,Geneva,sans-serif;">
      You’ll be meeting our team member who will be evaluating your interaction:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F5F9;border-left:4px solid #f05136;border-radius:0 6px 6px 0;padding:14px 18px;">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:15px;font-weight:bold;color:#0F172A;font-family:Verdana,Geneva,sans-serif;">
            ${escapeHtml(panelName)}
          </p>
          ${panelDesignation ? `<p style="margin:0 0 4px;font-size:13px;color:#475569;font-family:Verdana,Geneva,sans-serif;">${escapeHtml(panelDesignation)}</p>` : ""}
          ${linkedInBtn}
        </td>
      </tr>
    </table>
  </div>`;
}

function encodeEmojisToEntities(text: string): string {
  return String(text || "").replace(
    /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDDFF]|[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}])/gu,
    (match) => {
      const codePoint = match.codePointAt(0);
      return codePoint ? `&#${codePoint};` : match;
    }
  );
}

function wrapCallLetterHtml(arg1: string, arg2?: string): string {
  const contentHtml = arg2 !== undefined ? arg2 : arg1;
  const safeContent = encodeEmojisToEntities(contentHtml);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>FACE Prep | Interview Call Letter</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F6F9;font-family:Verdana,Geneva,'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F6F9;padding:30px 12px;font-family:Verdana,Geneva,'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#1A1A1A;padding:28px 40px;border-bottom:4px solid #f05136;">
              <img src="https://faceprep.in/images/brand/wordmark-on-dark.png" alt="FACE Prep" width="140" style="display:block;border:0;margin-bottom:14px;height:auto;"/>
              <p style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:bold;color:#ffffff;line-height:1.2;">
                Interview Call Letter
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 24px;color:#2D3748;line-height:1.75;font-size:14px;font-family:Verdana,Geneva,'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif;">
              ${safeContent}
            </td>
          </tr>
          <!-- SIGN-OFF -->
          <tr>
            <td id="call-letter-signature" style="padding:16px 40px 32px;border-top:1px solid #F1F5F9;font-size:13px;color:#64748B;">
              Warm regards,<br/>
              <strong style="color:#1A1A1A;font-size:14px;">Talent Acquisition Team</strong><br/>
              FACE Prep
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:24px 40px;border-top:1px solid #E2E8F0;text-align:center;font-size:11px;color:#94A3B8;line-height:1.6;">
              <p style="margin:0 0 8px;">
                <a href="https://faceprep.in" style="color:#f05136;text-decoration:none;font-weight:bold;">FACE Prep</a> &nbsp;|&nbsp;
                <a href="https://faceprep.in/contact" style="color:#f05136;text-decoration:none;">Contact Support</a>
              </p>
              <p style="margin:0;">
                FACE Prep (Focus 4D Career Education) · No. 12, Lakshmi Nagar, Thottipalayam Pirivu, Off Avinashi Road, Coimbatore – 641014
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildTemplate(
  type: string,
  row: Candidate,
  headers: string[],
  mapping: ColumnMapping,
  panelOverride?: PanelMemberOverride
): Template | null {
  const name = getName(row, headers, mapping) || "Candidate";
  const candidateId = getId(row, headers, mapping);
  const date = getDate(row, headers, mapping);
  const time = getTime(row, headers, mapping);
  const link = getLink(row, headers, mapping);
  const jobTitle = getJob(row, headers, mapping);
  const evaluator = getEvaluator(row, headers, mapping);

  const panelName = panelOverride?.name || evaluator;
  const panelDesignation = panelOverride?.designation || getPanelDesignation(row, headers, mapping);
  const panelLinkedin = panelOverride?.linkedin || getPanelLinkedin(row, headers, mapping);

  const t = type.toLowerCase().trim();

  // ── 1. Virtual Interview (Internal) ─────────────────────────────────────────
  if (t === "virtual" || t === "online" || t === "zoom" || t === "teams" || t === "google meet") {
    const roleLabel = jobTitle || "the position";
    const subject = "We’re Excited to Meet You! | Interview with FACE Prep";

    const body = `Hi ${name},

Hello from FACE Prep! 👋

Great news — we’d love to take the conversation forward!

We’re happy to invite you for an interview for the role of ${roleLabel} at FACE Prep. This will be an opportunity for us to get to know you better — your journey, what you’re great at, what excites you, and what you’re looking to build next.

And of course, it’s equally an opportunity for you to get to know us!

Here’s when we’re meeting:

Interview Details
Mode: Virtual (Online)
Meeting Link: ${link || "[Insert Link]"}
Date: ${date || "[Insert Date]"}
Time: ${time || "[Insert Time]"}
Dress Code: Formal / Business Attire
${panelName ? `\nMeet the People You’ll Be Talking To\n\nYou’ll be meeting a few members of our team who are excited to hear your story:\n\n${panelName}${panelDesignation ? `\n${panelDesignation}` : ""}${panelLinkedin ? `\n${panelLinkedin}` : ""}\n` : ""}
What can you expect?

Not an interrogation. Not a rapid-fire Q&A. 😊

Just a good conversation about you, your experiences, your ideas, and where you want to go next.

We’ll also tell you more about life at FACE Prep, the team you could be working with, the role, and the kind of impact you can create here.

So come as you are, bring your questions, and let’s see where this conversation takes us!

P.S. Want a sneak peek into what it’s like to be part of FACE Prep? Check out @lifeatfaceprep on Instagram and meet the people behind what we do.

Virtual Interview Guidelines
To ensure a smooth and professional interview experience, please follow the instructions below:
- The interview must be attended using a laptop. Use of mobile phones or tablets is not permitted.
- Keep your camera turned on throughout the interview and use a blurred or neutral background to maintain a professional appearance.
- Ensure you have a stable and high-speed internet connection to avoid disruptions during the session.
- Attend the interview from a quiet and well-lit location. Please minimize background noise or interruptions.
- Dress in formal and presentable clothing as you would for an in-person interview.
- Join the virtual meeting at least 10 minutes before the scheduled time to check your audio, video, and connection settings.

Looking forward to meeting you! 🚀`;

    const contentHtml = `
      <p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:#1A1A1A;">
        Hi ${escapeHtml(name)},
      </p>
      <p style="margin:0 0 16px;">
        Hello from <strong>FACE Prep! 👋</strong>
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#f05136;font-weight:600;">
        Great news — we’d love to take the conversation forward!
      </p>
      <p style="margin:0 0 24px;color:#4A5568;">
        We’re happy to invite you for an interview for the role of <strong>${escapeHtml(roleLabel)}</strong> at FACE Prep. This will be an opportunity for us to get to know you better — your journey, what you’re great at, what excites you, and what you’re looking to build next.<br/><br/>
        And of course, it’s equally an opportunity for you to get to know us!<br/><br/>
        <strong>Here’s when we’re meeting:</strong>
      </p>

      <!-- INTERVIEW DETAILS CARD -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:28px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:#1E293B;text-transform:uppercase;letter-spacing:0.04em;">
              📅 Interview Details
            </p>
            <table width="100%" cellpadding="6" cellspacing="0" border="0" style="font-size:13px;color:#334155;">
              <tr>
                <td width="30%" style="font-weight:600;color:#64748B;">Mode:</td>
                <td style="font-weight:bold;color:#1E293B;">Virtual (Online)</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#64748B;">Date:</td>
                <td style="font-weight:bold;color:#1E293B;">${escapeHtml(date || "To be announced")}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#64748B;">Time:</td>
                <td style="font-weight:bold;color:#1E293B;">${escapeHtml(time || "To be announced")}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#64748B;">Dress Code:</td>
                <td>Formal / Business Attire</td>
              </tr>
              ${link ? `
              <tr>
                <td style="font-weight:600;color:#64748B;padding-top:10px;">Meeting Link:</td>
                <td style="padding-top:10px;">
                  <a href="${escapeHtml(link)}" target="_blank" style="display:inline-block;background:#f05136;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:4px;font-size:12px;font-weight:bold;letter-spacing:0.04em;font-family:Verdana,Geneva,sans-serif;">
                    Join Meeting &rarr;
                  </a>
                </td>
              </tr>` : ""}
            </table>
          </td>
        </tr>
      </table>

      ${renderPanelCardHtml(panelName, panelDesignation, panelLinkedin)}

      <!-- WHAT TO EXPECT -->
      <div style="margin-bottom:28px;">
        <p style="margin:0 0 10px;font-size:15px;font-weight:bold;color:#1E293B;">
          💡 What can you expect?
        </p>
        <p style="margin:0 0 10px;font-size:14px;color:#1E293B;font-weight:600;">
          Not an interrogation. Not a rapid-fire Q&A. 😊
        </p>
        <p style="margin:0 0 10px;font-size:14px;color:#4A5568;line-height:1.7;">
          Just a good conversation about you, your experiences, your ideas, and where you want to go next.
        </p>
        <p style="margin:0 0 14px;font-size:14px;color:#4A5568;line-height:1.7;">
          We’ll also tell you more about life at FACE Prep, the team you could be working with, the role, and the kind of impact you can create here. So come as you are, bring your questions, and let’s see where this conversation takes us!
        </p>
        <p style="margin:0;font-size:13px;color:#64748B;line-height:1.6;font-style:italic;">
          P.S. Want a sneak peek into what it’s like to be part of FACE Prep? Check out <a href="https://instagram.com/lifeatfaceprep" target="_blank" style="color:#f05136;text-decoration:none;font-weight:600;">@lifeatfaceprep</a> on Instagram and meet the people behind what we do.
        </p>
      </div>

      <!-- GUIDELINES SECTION -->
      <div style="margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:#1E293B;">
          📋 Virtual Interview Guidelines
        </p>
        <p style="margin:0 0 12px;font-size:13px;color:#64748B;">
          To ensure a smooth and professional interview experience, please follow the instructions below:
        </p>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#334155;line-height:1.7;">
          <li style="margin-bottom:6px;"><strong>Device:</strong> The interview must be attended using a laptop. Use of mobile phones or tablets is not permitted.</li>
          <li style="margin-bottom:6px;"><strong>Camera & Background:</strong> Keep your camera turned on throughout the interview and use a blurred or neutral background to maintain a professional appearance.</li>
          <li style="margin-bottom:6px;"><strong>Connectivity:</strong> Ensure you have a stable and high-speed internet connection to avoid disruptions during the session.</li>
          <li style="margin-bottom:6px;"><strong>Environment:</strong> Attend the interview from a quiet and well-lit location. Please minimize background noise or interruptions.</li>
          <li style="margin-bottom:6px;"><strong>Attire:</strong> Dress in formal and presentable clothing as you would for an in-person interview.</li>
          <li style="margin-bottom:6px;"><strong>Punctuality:</strong> Join the virtual meeting at least 10 minutes before the scheduled time to check your audio, video, and connection settings.</li>
        </ul>
      </div>

      <!-- ACKNOWLEDGMENT -->
      <div style="background:#F1F5F9;border-radius:6px;padding:12px 18px;margin-bottom:24px;font-size:13px;color:#334155;">
        💬 We request you to kindly acknowledge this email and confirm your availability for the scheduled interview.
      </div>

      <!-- CLOSING -->
      <p style="margin:24px 0 6px;font-size:15px;font-weight:bold;color:#1A1A1A;">
        Looking forward to meeting you! 🚀
      </p>
    `;

    return {
      subject,
      body,
      htmlBody: wrapCallLetterHtml("Virtual / Online Round", contentHtml),
      candidateId,
    };
  }

  // ── 2. Virtual Client Round ──────────────────────────────────────────────────
  if (t === "client" || t === "client interview" || t === "virtual client") {
    const roleLabel = jobTitle || "the position";
    const subject = "FACE Prep | Interview Call Letter – Virtual Interview with Client";

    const body = `Dear ${name},

Hello from FACE Prep! 👋

Great news — we’d love to take the conversation forward!

As part of the next stage of the process for the role of ${roleLabel}, you will be meeting one of our clients who is a senior academician. Please ensure that you are well prepared for this interaction and present yourself professionally.

Please ensure you adhere to the instructions below, as they are mandatory for the client interview. If any requirement is not met, you will not be eligible to attend. Kindly go through the guidelines thoroughly.

Here’s when we’re meeting:

Interview Details
Date: ${date || "[Insert Date]"}
Time: ${time || "[Insert Time]"}
Mode: Virtual (Online)${evaluator ? `\nInterviewer: ${evaluator}` : ""}
Dress Code: Formal Attire (Mandatory)
Meeting Link: ${link || "[Insert Link]"}
${panelName ? `\nMeet the People You’ll Be Talking To\n${panelName}${panelDesignation ? `\n${panelDesignation}` : ""}${panelLinkedin ? `\n${panelLinkedin}` : ""}\n` : ""}
Mandatory Instructions for the Client Interview:

1. Technical Readiness
If the meeting is virtual, please ensure:
- Stable internet connection
- Working microphone and camera
- Quiet environment without disturbances
- Laptop is mandatory (mobiles/tablets are strictly prohibited)

2. Be Punctual
Please join the meeting 10 minutes before the scheduled time to avoid any delays.

3. Professional Appearance
Ensure you are dressed in formal attire and maintain a professional appearance throughout the meeting.

4. Understand FACE Prep and the Role
Take some time to familiarize yourself with:
- FACE Prep and the services we provide
- The role you have applied for
- How your experience aligns with the responsibilities

5. Be Clear and Concise in Communication
Since the client is a senior academician, please ensure that:
- Your responses are clear, structured, and respectful
- You listen carefully before responding
- You avoid casual language

6. Demonstrate Preparation
Be ready to discuss:
- Your background and experience
- Your understanding of the role
- Why you are interested in working with FACE Prep

7. Maintain Professional Etiquette
- Address the client respectfully
- Allow the interviewer to complete their question before answering
- Keep your responses focused and relevant

We encourage you to treat this interaction with the same seriousness as a formal interview. Being prepared will help you make a strong impression.

We request you to kindly acknowledge this email and confirm your availability for the scheduled interview.

Wishing you the very best for the discussion! 🚀`;

    const contentHtml = `
      <p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:#1A1A1A;">
        Dear ${escapeHtml(name)},
      </p>
      <p style="margin:0 0 16px;">
        Hello from <strong>FACE Prep! 👋</strong>
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#f05136;font-weight:600;">
        Great news — we’d love to take the conversation forward!
      </p>
      <p style="margin:0 0 16px;color:#4A5568;">
        As part of the next stage of the process for the role of <strong>${escapeHtml(roleLabel)}</strong>, you will be meeting one of our clients who is a senior academician. Please ensure that you are well prepared for this interaction and present yourself professionally.
      </p>
      <p style="margin:0 0 24px;color:#DC2626;font-size:13px;font-weight:600;background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:12px 16px;">
        ⚠️ Please ensure you adhere to the instructions below, as they are mandatory for the client interview. If any requirement is not met, you will not be eligible to attend. Kindly go through the guidelines thoroughly.
      </p>

      <p style="margin:0 0 16px;font-weight:600;color:#1A1A1A;">
        Here’s when we’re meeting:
      </p>

      <!-- INTERVIEW DETAILS CARD -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:28px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:#1E293B;text-transform:uppercase;letter-spacing:0.04em;">
              📅 Interview Details
            </p>
            <table width="100%" cellpadding="6" cellspacing="0" border="0" style="font-size:13px;color:#334155;">
              <tr>
                <td width="30%" style="font-weight:600;color:#64748B;">Date:</td>
                <td style="font-weight:bold;color:#1E293B;">${escapeHtml(date || "To be announced")}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#64748B;">Time:</td>
                <td style="font-weight:bold;color:#1E293B;">${escapeHtml(time || "To be announced")}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#64748B;">Mode:</td>
                <td style="font-weight:bold;color:#1E293B;">Virtual (Online)</td>
              </tr>
              ${evaluator ? `
              <tr>
                <td style="font-weight:600;color:#64748B;">Interviewer:</td>
                <td style="font-weight:bold;color:#1E293B;">${escapeHtml(evaluator)}</td>
              </tr>` : ""}
              <tr>
                <td style="font-weight:600;color:#64748B;">Dress Code:</td>
                <td>Formal Attire (Mandatory)</td>
              </tr>
              ${link ? `
              <tr>
                <td style="font-weight:600;color:#64748B;padding-top:10px;">Meeting Link:</td>
                <td style="padding-top:10px;">
                  <a href="${escapeHtml(link)}" target="_blank" style="display:inline-block;background:#f05136;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:4px;font-size:12px;font-weight:bold;letter-spacing:0.04em;font-family:Verdana,Geneva,sans-serif;">
                    Join Meeting &rarr;
                  </a>
                </td>
              </tr>` : ""}
            </table>
          </td>
        </tr>
      </table>

      ${renderPanelCardHtml(panelName, panelDesignation, panelLinkedin)}

      <!-- WHAT TO EXPECT BOX -->
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:18px 22px;margin-bottom:28px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#92400E;">
          💡 What can you expect?
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#78350F;font-weight:500;">
          Not an interrogation. Not a rapid-fire Q&A. 😊
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#92400E;line-height:1.6;">
          A thoughtful and intellectual interaction regarding your domain expertise, pedagogy, communication clarity, and academic passion.
        </p>
        <p style="margin:0;font-size:13px;color:#92400E;line-height:1.6;">
          Being well-prepared will help you make a strong impression on the client panel.
        </p>
      </div>

      <!-- MANDATORY 7 INSTRUCTIONS -->
      <div style="margin-bottom:28px;">
        <p style="margin:0 0 14px;font-size:15px;font-weight:bold;color:#1E293B;">
          📋 Mandatory Instructions for the Client Interview
        </p>
        
        <div style="background:#F8FAFC;border-radius:6px;border-left:3px solid #64748B;padding:12px 16px;margin-bottom:12px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#0F172A;">1. Technical Readiness</p>
          <p style="margin:0 0 6px;font-size:12px;color:#475569;">If the meeting is virtual, please ensure:</p>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:#334155;line-height:1.6;">
            <li>Stable internet connection</li>
            <li>Working microphone and camera</li>
            <li>Quiet environment without disturbances</li>
            <li>Laptop is mandatory (mobiles/tablets are strictly prohibited)</li>
          </ul>
        </div>

        <div style="background:#F8FAFC;border-radius:6px;border-left:3px solid #64748B;padding:12px 16px;margin-bottom:12px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#0F172A;">2. Be Punctual</p>
          <p style="margin:0;font-size:12px;color:#334155;line-height:1.6;">
            Please join the meeting 10 minutes before the scheduled time to avoid any delays.
          </p>
        </div>

        <div style="background:#F8FAFC;border-radius:6px;border-left:3px solid #64748B;padding:12px 16px;margin-bottom:12px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#0F172A;">3. Professional Appearance</p>
          <p style="margin:0;font-size:12px;color:#334155;line-height:1.6;">
            Ensure you are dressed in formal attire and maintain a professional appearance throughout the meeting.
          </p>
        </div>

        <div style="background:#F8FAFC;border-radius:6px;border-left:3px solid #64748B;padding:12px 16px;margin-bottom:12px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#0F172A;">4. Understand FACE Prep and the Role</p>
          <p style="margin:0 0 6px;font-size:12px;color:#475569;">Take some time to familiarize yourself with:</p>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:#334155;line-height:1.6;">
            <li>FACE Prep and the services we provide</li>
            <li>The role you have applied for</li>
            <li>How your experience aligns with the responsibilities</li>
          </ul>
        </div>

        <div style="background:#F8FAFC;border-radius:6px;border-left:3px solid #64748B;padding:12px 16px;margin-bottom:12px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#0F172A;">5. Be Clear and Concise in Communication</p>
          <p style="margin:0 0 6px;font-size:12px;color:#475569;">Since the client is a senior academician, please ensure that:</p>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:#334155;line-height:1.6;">
            <li>Your responses are clear, structured, and respectful</li>
            <li>You listen carefully before responding</li>
            <li>You avoid casual language</li>
          </ul>
        </div>

        <div style="background:#F8FAFC;border-radius:6px;border-left:3px solid #64748B;padding:12px 16px;margin-bottom:12px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#0F172A;">6. Demonstrate Preparation</p>
          <p style="margin:0 0 6px;font-size:12px;color:#475569;">Be ready to discuss:</p>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:#334155;line-height:1.6;">
            <li>Your background and experience</li>
            <li>Your understanding of the role</li>
            <li>Why you are interested in working with FACE Prep</li>
          </ul>
        </div>

        <div style="background:#F8FAFC;border-radius:6px;border-left:3px solid #64748B;padding:12px 16px;margin-bottom:12px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#0F172A;">7. Maintain Professional Etiquette</p>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:#334155;line-height:1.6;">
            <li>Address the client respectfully</li>
            <li>Allow the interviewer to complete their question before answering</li>
            <li>Keep your responses focused and relevant</li>
          </ul>
        </div>
      </div>

      <p style="margin:0 0 20px;font-size:13px;color:#4A5568;line-height:1.7;">
        We encourage you to treat this interaction with the same seriousness as a formal interview. Being prepared will help you make a strong impression.
      </p>

      <!-- ACKNOWLEDGMENT -->
      <div style="background:#F1F5F9;border-radius:6px;padding:12px 18px;margin-bottom:24px;font-size:13px;color:#334155;">
        💬 We request you to kindly acknowledge this email and confirm your availability for the scheduled interview.
      </div>

      <!-- CLOSING -->
      <p style="margin:24px 0 6px;font-size:15px;font-weight:bold;color:#1A1A1A;">
        Wishing you the very best for the discussion! 🚀
      </p>
    `;

    return {
      subject,
      body,
      htmlBody: wrapCallLetterHtml("Virtual Client Round", contentHtml),
      candidateId,
    };
  }

  // ── 3. In-Person Walk-in Interview ──────────────────────────────────────────
  if (t === "in-person" || t === "in person" || t === "offline" || t === "walk-in") {
    const roleLabel = jobTitle || "the position";
    const subject = "FACE Prep | Interview Call Letter";

    const body = `Dear ${name},

Hello from FACE Prep! 👋

Great news — we’d love to take the conversation forward!

We are pleased to inform you that you have been shortlisted for an interview with our team for the role of ${roleLabel}. Please find the details of your interview below and make the necessary arrangements to attend.

Here’s when we’re meeting:

Interview Details
Date: ${date || "[Insert Date]"}
Reporting Time: ${time || "[Insert Time]"}
Mode: In-person Interview${evaluator ? `\nInterviewer: ${evaluator}` : ""}
Dress Code: Formal / Professional Attire
Venue: No. 12, Lakshmi Nagar, Thottipalayam Pirivu, Off Avinashi Road, Coimbatore, Tamil Nadu – 641014
${panelName ? `\nMeet the People You’ll Be Talking To\n${panelName}${panelDesignation ? `\n${panelDesignation}` : ""}${panelLinkedin ? `\n${panelLinkedin}` : ""}\n` : ""}
What can you expect?
Not an interrogation. Not a rapid-fire Q&A. 😊
Just a good conversation about you, your experiences, your ideas, and where you want to go next.
We’ll also tell you more about life at FACE Prep, the team you could be working with, the role, and the kind of impact you can create here.
So come as you are, bring your questions, and let’s see where this conversation takes us!

Instructions for the Candidate:
- A hard copy of your updated resume
- Please bring your laptop, as it may be required for technical assessments or practical rounds during the interview process.
- Kindly attend the interview in formal and professional attire.
- Please arrive 15 minutes before your reporting time for visitor check-in.

We request you to kindly acknowledge this email and confirm your availability for the scheduled interview.

We look forward to meeting you in person and discussing how your skills and aspirations align with our organization's goals.

Looking forward to meeting you! 🚀`;

    const contentHtml = `
      <p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:#1A1A1A;">
        Dear ${escapeHtml(name)},
      </p>
      <p style="margin:0 0 16px;">
        Hello from <strong>FACE Prep! 👋</strong>
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#f05136;font-weight:600;">
        Great news — we’d love to take the conversation forward!
      </p>
      <p style="margin:0 0 24px;color:#4A5568;">
        We are pleased to inform you that you have been shortlisted for an interview with our team for the role of <strong>${escapeHtml(roleLabel)}</strong>. Please find the details of your interview below and make the necessary arrangements to attend.<br/><br/>
        <strong>Here’s when we’re meeting:</strong>
      </p>

      <!-- INTERVIEW DETAILS CARD -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:28px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:#1E293B;text-transform:uppercase;letter-spacing:0.04em;">
              🏢 Interview & Venue Details
            </p>
            <table width="100%" cellpadding="6" cellspacing="0" border="0" style="font-size:13px;color:#334155;">
              <tr>
                <td width="32%" style="font-weight:600;color:#64748B;">Date:</td>
                <td style="font-weight:bold;color:#1E293B;">${escapeHtml(date || "To be announced")}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#64748B;">Reporting Time:</td>
                <td style="font-weight:bold;color:#1E293B;">${escapeHtml(time || "To be announced")}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#64748B;">Mode:</td>
                <td style="font-weight:bold;color:#1E293B;">In-person Interview</td>
              </tr>
              ${evaluator ? `
              <tr>
                <td style="font-weight:600;color:#64748B;">Interviewer:</td>
                <td style="font-weight:bold;color:#1E293B;">${escapeHtml(evaluator)}</td>
              </tr>` : ""}
              <tr>
                <td style="font-weight:600;color:#64748B;">Dress Code:</td>
                <td>Formal / Professional Attire</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#64748B;vertical-align:top;padding-top:8px;">Venue:</td>
                <td style="line-height:1.6;padding-top:8px;">
                  <strong>No. 12, Lakshmi Nagar, Thottipalayam Pirivu,</strong><br/>
                  Off Avinashi Road, Coimbatore, Tamil Nadu – 641014
                  <div style="margin-top:10px;">
                    <a href="https://maps.google.com/?q=No.+12,+Lakshmi+Nagar,+Thottipalayam+Pirivu,+Off+Avinashi+Road,+Coimbatore,+Tamil+Nadu+641014" target="_blank" style="display:inline-block;background:#f05136;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:4px;font-size:11px;font-weight:bold;letter-spacing:0.04em;font-family:Verdana,Geneva,sans-serif;">
                      Get Directions on Google Maps &rarr;
                    </a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${renderPanelCardHtml(panelName, panelDesignation, panelLinkedin)}

      <!-- WHAT TO EXPECT -->
      <div style="margin-bottom:28px;">
        <p style="margin:0 0 10px;font-size:15px;font-weight:bold;color:#1E293B;">
          💡 What can you expect?
        </p>
        <p style="margin:0 0 10px;font-size:14px;color:#1E293B;font-weight:600;">
          Not an interrogation. Not a rapid-fire Q&A. 😊
        </p>
        <p style="margin:0 0 10px;font-size:14px;color:#4A5568;line-height:1.7;">
          Just a good conversation about you, your experiences, your ideas, and where you want to go next.
        </p>
        <p style="margin:0 0 14px;font-size:14px;color:#4A5568;line-height:1.7;">
          We’ll also tell you more about life at FACE Prep, the team you could be working with, the role, and the kind of impact you can create here. So come as you are, bring your questions, and let’s see where this conversation takes us!
        </p>
        <p style="margin:0;font-size:13px;color:#64748B;line-height:1.6;font-style:italic;">
          P.S. Want a sneak peek into what it’s like to be part of FACE Prep? Check out <a href="https://instagram.com/lifeatfaceprep" target="_blank" style="color:#f05136;text-decoration:none;font-weight:600;">@lifeatfaceprep</a> on Instagram and meet the people behind what we do.
        </p>
      </div>

      <!-- INSTRUCTIONS FOR CANDIDATE -->
      <div style="margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:#1E293B;">
          📋 Instructions for the Candidate
        </p>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#334155;line-height:1.8;">
          <li style="margin-bottom:6px;"><strong>Updated Resume:</strong> A printed hard copy of your updated resume.</li>
          <li style="margin-bottom:6px;"><strong>Laptop Required:</strong> Please bring your laptop, as it may be required for technical assessments or practical rounds during the interview process.</li>
          <li style="margin-bottom:6px;"><strong>Dress Code:</strong> Kindly attend the interview in formal and professional attire.</li>
          <li style="margin-bottom:6px;"><strong>Punctuality:</strong> Please arrive 15 minutes before your reporting time for visitor check-in.</li>
        </ul>
      </div>

      <!-- ACKNOWLEDGMENT -->
      <div style="background:#F1F5F9;border-radius:6px;padding:12px 18px;margin-bottom:24px;font-size:13px;color:#334155;">
        💬 We request you to kindly acknowledge this email and confirm your availability for the scheduled interview.
      </div>

      <p style="margin:24px 0 6px;font-size:14px;color:#4A5568;line-height:1.7;">
        We look forward to meeting you in person and discussing how your skills and aspirations align with our organization's goals.
      </p>
      <p style="margin:10px 0 6px;font-size:15px;font-weight:bold;color:#1A1A1A;">
        Looking forward to meeting you! 🚀
      </p>
    `;

    return {
      subject,
      body,
      htmlBody: wrapCallLetterHtml("In-Person Walk-in Interview", contentHtml),
      candidateId,
    };
  }

  return null;
}


// ── badges ─────────────────────────────────────────────────────────────────────
function TypeBadge({ value }: { value: string }) {
  const v = (value ?? "").toLowerCase();
  if (v.includes("client")) return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200">Client</Badge>;
  if (v.includes("virtual") || v.includes("online") || v.includes("zoom"))
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Virtual</Badge>;
  if (v.includes("in-person") || v.includes("offline") || v.includes("walk"))
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">In-Person</Badge>;
  return <Badge variant="secondary">{value || "—"}</Badge>;
}

function EmailStatusBadge({ value }: { value: string }) {
  const v = value ?? "";
  if (!v) return <span className="text-muted-foreground text-xs">—</span>;
  if (v.startsWith("✓")) return <span className="text-green-600 text-xs font-medium flex items-center gap-1"><CheckSquare className="h-3 w-3" />{v}</span>;
  if (v.startsWith("✗")) return <span className="text-red-500 text-xs font-medium">{v}</span>;
  if (v === "Skipped") return <span className="text-muted-foreground text-xs">Skipped</span>;
  return <span className="text-xs">{v}</span>;
}

const TYPE_COLS = new Set(["mode of interview", "interview type", "type", "mode", "interview mode"]);
const HIDDEN_SYSTEM = new Set(["email status", "mail sent status", "_rowindex"]);

const KNOWN_TYPES = new Set([
  "client", "client interview", "virtual client",
  "in-person", "in person", "offline", "walk-in",
  "virtual", "online", "zoom", "teams", "google meet",
]);

// ── main component ─────────────────────────────────────────────────────────────
export default function CandidatesTable({ sheetUrl, columnMapping = {} }: { sheetUrl: string; columnMapping?: ColumnMapping }) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRows, setTotalRows] = useState(0);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());
  const [colsInit, setColsInit] = useState(false);
  const colsInitRef = useRef(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [selectedPanel, setSelectedPanel] = useState<string>("auto");

  // Dynamically extract unique interviewers/panel members from the active sheet data
  const availablePanelMembers = useMemo(() => {
    const map = new Map<string, { name: string; designation?: string; linkedin?: string }>();
    for (const r of allRows) {
      const pName = getEvaluator(r, headers, columnMapping).trim();
      if (pName && !map.has(pName)) {
        const pDesig = getPanelDesignation(r, headers, columnMapping).trim();
        const pLink = getPanelLinkedin(r, headers, columnMapping).trim();
        map.set(pName, { name: pName, designation: pDesig, linkedin: pLink });
      }
    }
    return Array.from(map.values());
  }, [allRows, headers, columnMapping]);

  // Reset state when sheetUrl changes
  useEffect(() => {
    setColsInit(false);
    colsInitRef.current = false;
    setVisibleCols(new Set());
    setAllRows([]);
    setHeaders([]);
    setPage(1);
    setSelected(new Set());
    setTypeFilter("all");
    setSelectedPanel("auto");
  }, [sheetUrl]);

  const fetchData = useCallback(async () => {
    if (!sheetUrl) return;
    setLoading(true);
    try {
      // Fetch all data (no limit) to allow client-side searching and sorting
      const res = await fetch(`/api/sheet?url=${encodeURIComponent(sheetUrl)}`);
      const text = await res.text();
      let json: SheetResponse;
      try {
        json = JSON.parse(text);
      } catch {
        console.error("[fetchData] Non-JSON response:", text.slice(0, 300));
        toast.error(`Server returned unexpected response (${res.status})`);
        return;
      }
      if (json.status === "success") {
        const coercedHeaders = json.headers.map((h: unknown) => (h == null ? "" : String(h)));
        setHeaders(coercedHeaders);
        setAllRows(json.data); // Backend now returns all rows, reversed (newest first)
        setTotalRows(json.data.length);
        setSelected(new Set());
        if (!colsInitRef.current) {
          colsInitRef.current = true;
          setColsInit(true);
          setVisibleCols(new Set(coercedHeaders.filter((h) => !HIDDEN_SYSTEM.has(h.toLowerCase()) && h.trim() !== "")));
        }
      } else {
        toast.error(json.message || "Failed to load sheet data");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[fetchData] error:", msg);
      toast.error(`Network error loading sheet: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [sheetUrl]); // colsInit removed — using ref to avoid re-creating fetchData on init

  useEffect(() => { fetchData(); }, [fetchData]);

  const emailStatusHeader = useMemo(() => {
    // Use mapped column if set, otherwise find by known names
    if (columnMapping.emailStatus) return columnMapping.emailStatus;
    return headers.find((h) => ["email status", "mail sent status"].includes(h.toLowerCase()));
  }, [headers, columnMapping]);

  const selectableHeaders = useMemo(
    () => headers.filter((h) => {
      if (typeof h !== "string") return false;
      const lower = h.toLowerCase().trim();
      return !HIDDEN_SYSTEM.has(lower) && h !== emailStatusHeader && h.trim() !== "";
    }),
    [headers, emailStatusHeader]
  );

  const filtered = useMemo(() => {
    let rows = allRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((row) =>
        selectableHeaders.some((h) => String(row[h] ?? "").toLowerCase().includes(q))
      );
    }
    if (typeFilter !== "all") {
      rows = rows.filter((row) => {
        const t = getType(row, headers, columnMapping).toLowerCase().trim();
        if (typeFilter === "client") return t === "client" || t === "client interview" || t === "virtual client";
        if (typeFilter === "virtual") return t === "virtual" || t === "online" || t === "zoom" || t === "teams" || t === "google meet";
        if (typeFilter === "in-person") return t === "in-person" || t === "in person" || t === "offline" || t === "walk-in";
        return true;
      });
    }
    return rows;
  }, [allRows, search, typeFilter, selectableHeaders, headers]);

  // Client-side pagination: slice the filtered results
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);
  // ── stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = allRows.length;
    const sent = allRows.filter((r) => {
      const s = emailStatusHeader ? String(r[emailStatusHeader] ?? "") : "";
      return s.startsWith("✓ Sent");
    }).length;
    const failed = allRows.filter((r) => {
      const s = emailStatusHeader ? String(r[emailStatusHeader] ?? "") : "";
      return s.startsWith("✗");
    }).length;
    const pending = allRows.filter((r) => {
      const email = getEmail(r, headers, columnMapping);
      const type = getType(r, headers, columnMapping).toLowerCase().trim();
      const status = emailStatusHeader ? String(r[emailStatusHeader] ?? "") : "";
      return !!email && KNOWN_TYPES.has(type) && !status.startsWith("✓ Sent");
    }).length;
    return { total, sent, failed, pending };
  }, [allRows, emailStatusHeader, headers]);

  function toggleCol(col: string) {
    setVisibleCols((prev) => { const n = new Set(prev); n.has(col) ? n.delete(col) : n.add(col); return n; });
  }
  function toggleRow(idx: number) {
    setSelected((prev) => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  }
  function toggleAll() {
    const sendableOnPage = pageRows.filter(canSendRow).map((r) => r._rowIndex);
    const allSendableSelected = sendableOnPage.length > 0 && sendableOnPage.every((idx) => selected.has(idx));
    if (allSendableSelected) {
      // deselect all sendable on this page
      setSelected((prev) => { const n = new Set(prev); sendableOnPage.forEach((idx) => n.delete(idx)); return n; });
    } else {
      // select all sendable on this page
      setSelected((prev) => { const n = new Set(prev); sendableOnPage.forEach((idx) => n.add(idx)); return n; });
    }
  }

  // ── can send? ────────────────────────────────────────────────────────────────
  function canSendRow(row: Candidate) {
    const email = getEmail(row, headers, columnMapping);
    const type = getType(row, headers, columnMapping).toLowerCase().trim();
    const status = emailStatusHeader ? String(row[emailStatusHeader] ?? "") : "";
    return !!email && KNOWN_TYPES.has(type) && !status.startsWith("✓ Sent");
  }

  // ── send single ──────────────────────────────────────────────────────────────
  async function sendEmail(row: Candidate) {
    const email = getEmail(row, headers, columnMapping);
    if (!email) return;
    const type = getType(row, headers, columnMapping);
    const panelOverride = selectedPanel !== "auto" ? availablePanelMembers.find((p) => p.name === selectedPanel) : undefined;
    const template = buildTemplate(type, row, headers, columnMapping, panelOverride);
    if (!template) {
      toast.error(`Unknown interview type: "${type}". Use: Client, Virtual, or In-Person.`);
      return;
    }
    setSending((s) => ({ ...s, [row._rowIndex]: true }));
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({
          sheetUrl,
          rowIndex: row._rowIndex,
          to: email,
          subject: template.subject,
          body: template.body,
          htmlBody: template.htmlBody,
          candidateId: template.candidateId,
          candidateName: getName(row, headers, columnMapping),
          cc: row["CC"] || row["cc"] || "",
          sender_name: "Talent Acquisition Team",
          evaluatorEmail: getEvaluatorEmail(row, headers, columnMapping),
          evaluatorName: panelOverride?.name || getEvaluator(row, headers, columnMapping),
          panelDesignation: panelOverride?.designation || getPanelDesignation(row, headers, columnMapping),
          panelLinkedin: panelOverride?.linkedin || getPanelLinkedin(row, headers, columnMapping),
          resumeUrl: getResumeUrl(row, headers, columnMapping),
          jobTitle: getJob(row, headers, columnMapping),
          date: getDate(row, headers, columnMapping),
          time: getTime(row, headers, columnMapping),
          link: getLink(row, headers, columnMapping),
          interviewType: type,
        }),
      });
      const data = await res.json();
      if (data.status === "sent") {
        toast.success(`Sent to ${email}`);
        setAllRows((prev) =>
          prev.map((r) =>
            r._rowIndex === row._rowIndex && emailStatusHeader
              ? { ...r, [emailStatusHeader]: `✓ Sent to ${email}` }
              : r
          )
        );
      } else {
        toast.error(data.error || "Failed to send");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSending((s) => ({ ...s, [row._rowIndex]: false }));
    }
  }

  // ── bulk send ────────────────────────────────────────────────────────────────
  async function sendBulk() {
    const rows = allRows.filter((r) => selected.has(r._rowIndex) && canSendRow(r));
    if (!rows.length) return;
    setBulkSending(true);
    setBulkProgress({ current: 0, total: rows.length });
    let success = 0, failed = 0;
    const errors: string[] = [];
    const panelOverride = selectedPanel !== "auto" ? availablePanelMembers.find((p) => p.name === selectedPanel) : undefined;
    for (const row of rows) {
      const email = getEmail(row, headers, columnMapping);
      const type = getType(row, headers, columnMapping);
      const template = buildTemplate(type, row, headers, columnMapping, panelOverride);
      if (!template) { failed++; errors.push(email || `row ${row._rowIndex}`); setBulkProgress((p) => ({ ...p, current: p.current + 1 })); continue; }
      try {
        const res = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify({
            sheetUrl,
            rowIndex: row._rowIndex,
            to: email,
            subject: template.subject,
            body: template.body,
            htmlBody: template.htmlBody,
            candidateId: template.candidateId,
            candidateName: getName(row, headers, columnMapping),
            cc: row["CC"] || row["cc"] || "",
            sender_name: "Talent Acquisition Team",
            evaluatorEmail: getEvaluatorEmail(row, headers, columnMapping),
            evaluatorName: panelOverride?.name || getEvaluator(row, headers, columnMapping),
            panelDesignation: panelOverride?.designation || getPanelDesignation(row, headers, columnMapping),
            panelLinkedin: panelOverride?.linkedin || getPanelLinkedin(row, headers, columnMapping),
            resumeUrl: getResumeUrl(row, headers, columnMapping),
            jobTitle: getJob(row, headers, columnMapping),
            date: getDate(row, headers, columnMapping),
            time: getTime(row, headers, columnMapping),
            link: getLink(row, headers, columnMapping),
            interviewType: type,
          }),
        });
        const data = await res.json();
        if (data.status === "sent") {
          success++;
          setAllRows((prev) =>
            prev.map((r) =>
              r._rowIndex === row._rowIndex && emailStatusHeader
                ? { ...r, [emailStatusHeader]: `✓ Sent to ${email}` }
                : r
            )
          );
        } else {
          failed++;
          errors.push(email || `row ${row._rowIndex}`);
        }
      } catch {
        failed++;
        errors.push(email || `row ${row._rowIndex}`);
      }
      setBulkProgress((p) => ({ ...p, current: p.current + 1 }));
    }
    setBulkSending(false);
    setBulkOpen(false);
    setSelected(new Set());
    if (failed > 0) {
      toast.error(`${failed} failed: ${errors.slice(0, 3).join(", ")}${errors.length > 3 ? ` +${errors.length - 3} more` : ""}`);
    }
    if (success > 0) {
      toast.success(`Sent ${success} emails successfully.`);
    }
  }

  const displayHeaders = selectableHeaders.filter((h) => visibleCols.has(h));
  const eligibleCount = allRows.filter((r) => selected.has(r._rowIndex) && canSendRow(r)).length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap bg-card border rounded-lg p-3">
        <Input
          placeholder="Search candidates..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-64 h-9 text-sm"
        />

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v ?? "all"); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="virtual">Virtual</SelectItem>
            <SelectItem value="in-person">In-Person</SelectItem>
          </SelectContent>
        </Select>

        {/* Panel Member Dropdown from Sheet */}
        <Select value={selectedPanel} onValueChange={(v) => setSelectedPanel(v ?? "auto")}>
          <SelectTrigger className="w-56 h-9 text-xs">
            <User className="h-3.5 w-3.5 mr-1.5 text-slate-500 shrink-0" />
            <SelectValue placeholder="Panel: Auto (Sheet Row)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">
              <span className="font-semibold text-blue-600">Auto: From Sheet Row</span>
            </SelectItem>
            {availablePanelMembers.map((pm) => (
              <SelectItem key={pm.name} value={pm.name}>
                {pm.name} {pm.designation ? `(${pm.designation})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Column visibility */}
        <Popover>
          <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent transition-colors h-9">
            <Columns3 className="h-3.5 w-3.5" />
            Columns
            {visibleCols.size < selectableHeaders.length && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs h-4">
                {selectableHeaders.length - visibleCols.size} hidden
              </Badge>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <p className="text-xs font-semibold text-muted-foreground px-1 mb-2">Toggle columns</p>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {selectableHeaders.map((h, i) => (
                <label key={`col-${h}-${i}`} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                  <Checkbox checked={visibleCols.has(h)} onCheckedChange={() => toggleCol(h)} />
                  <span className="truncate">{h || <span className="text-muted-foreground italic">unnamed</span>}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-1 mt-2 pt-2 border-t">
              <Button variant="ghost" size="sm" className="h-7 text-xs flex-1"
                onClick={() => setVisibleCols(new Set(selectableHeaders))}>All</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs flex-1"
                onClick={() => setVisibleCols(new Set())}>None</Button>
            </div>
          </PopoverContent>
        </Popover>

        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
          <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[10, 20, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} rows</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="h-9" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>

        <div className="flex-1" />

        {selected.size > 0 && (
          <Button size="sm" className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700"
            onClick={() => setBulkOpen(true)}>
            <Mail className="h-3.5 w-3.5" />
            Send {selected.size} selected
          </Button>
        )}

        <span className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${totalRows} total candidates`}
        </span>
      </div>

      {/* Stats bar */}
      {allRows.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Sheet Total", value: totalRows, color: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
            { label: "Pending (Page)", value: stats.pending, color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
            { label: "Sent (Page)", value: stats.sent, color: "text-green-700", bg: "bg-green-50 border-green-200" },
            { label: "Failed (Page)", value: stats.failed, color: "text-red-700", bg: "bg-red-50 border-red-200" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-lg border p-3 ${bg}`}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="table-auto w-full">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10 px-3">
                  {(() => {
                    const sendableOnPage = pageRows.filter(canSendRow);
                    const allSelected = sendableOnPage.length > 0 && sendableOnPage.every((r) => selected.has(r._rowIndex));
                    const someSelected = sendableOnPage.some((r) => selected.has(r._rowIndex));
                    return (
                      <Checkbox
                        checked={allSelected}
                        data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                        onCheckedChange={toggleAll}
                        disabled={sendableOnPage.length === 0}
                        title={sendableOnPage.length === 0 ? "No sendable rows on this page" : "Select all sendable rows"}
                      />
                    );
                  })()}
                </TableHead>
                {displayHeaders.map((h, i) => (
                  <TableHead key={`${h}-${i}`} className="font-semibold text-xs px-3 py-2 min-w-[120px] whitespace-normal break-words">{h}</TableHead>
                ))}
                <TableHead className="text-xs px-3 py-2 min-w-[160px] whitespace-normal">Email Status</TableHead>
                <TableHead className="text-right text-xs px-3 py-2 w-[90px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && allRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={displayHeaders.length + 3} className="text-center py-16">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground mt-2">Loading from Google Sheets…</p>
                  </TableCell>
                </TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={displayHeaders.length + 3} className="text-center py-16 text-muted-foreground text-sm">
                    No candidates found
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => {
                  const email = getEmail(row, headers, columnMapping);
                  const type = getType(row, headers, columnMapping);
                  const emailStatus = emailStatusHeader ? String(row[emailStatusHeader] ?? "") : "";
                  const alreadySent = emailStatus.startsWith("✓ Sent");
                  const sendable = canSendRow(row);

                  return (
                    <TableRow key={row._rowIndex}
                      className={`text-sm ${selected.has(row._rowIndex) ? "bg-blue-50" : ""}`}>
                      <TableCell className="py-2 px-3 align-top">
                        <Checkbox
                          checked={selected.has(row._rowIndex)}
                          onCheckedChange={() => canSendRow(row) && toggleRow(row._rowIndex)}
                          disabled={!canSendRow(row)}
                          title={!canSendRow(row) ? "No email or interview type set, or already sent" : ""}
                        />
                      </TableCell>
                      {displayHeaders.map((h, i) => (
                        <TableCell key={`${h}-${i}`} className="py-2 px-3 align-top overflow-hidden">
                          <div className="break-words whitespace-normal text-xs leading-relaxed">
                            {TYPE_COLS.has(h.toLowerCase())
                              ? <TypeBadge value={String(row[h] ?? "")} />
                              : String(row[h] ?? "") || <span className="text-muted-foreground">—</span>
                            }
                          </div>
                        </TableCell>
                      ))}
                      <TableCell className="py-2 px-3 align-top overflow-hidden">
                        <div className="break-words whitespace-normal text-xs leading-relaxed">
                          <EmailStatusBadge value={emailStatus} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-2 px-3 align-top">
                        {!email ? (
                          <span className="text-xs text-muted-foreground">No email</span>
                        ) : alreadySent ? (
                          <Badge variant="outline" className="text-green-600 border-green-200 text-xs">✓ Sent</Badge>
                        ) : (
                          <Button
                            size="sm" className="h-7 text-xs"
                            disabled={!sendable || !!sending[row._rowIndex]}
                            onClick={() => {
                              const pName = selectedPanel !== "auto" ? selectedPanel : (getEvaluator(row, headers, columnMapping) || "Auto");
                              if (window.confirm(`Send ${type || "interview"} call letter to ${email}?\nPanel Member: ${pName}`)) {
                                sendEmail(row);
                              }
                            }}
                            variant={sendable ? "default" : "secondary"}
                            title={!type ? "Set Interview Type column to enable sending" : `Send call letter to ${email}`}
                          >
                            {sending[row._rowIndex]
                              ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              : <Send className="h-3 w-3 mr-1" />}
                            Send
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm bg-card border rounded-lg p-3">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {totalRows} total rows
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0"
              disabled={page <= 1} onClick={() => setPage(1)}>«</Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0"
              disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0"
              disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0"
              disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</Button>
          </div>
        </div>
      )}

      {/* Bulk send dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Bulk Interview Call Letters</DialogTitle>
            <DialogDescription>
              You&apos;ve selected <strong>{selected.size}</strong> rows.{" "}
              <strong>{eligibleCount}</strong> are eligible (have email + interview type, not already sent).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
              <p><strong>Templates used by type:</strong></p>
              <p>• <strong>Client</strong> — Virtual interview with senior academician</p>
              <p>• <strong>Virtual / Online</strong> — Internal virtual interview with meeting link</p>
              <p>• <strong>In-Person / Offline</strong> — Walk-in interview at Coimbatore office</p>
            </div>
            <div className="bg-slate-50 border rounded-lg p-2.5 text-xs text-slate-700 flex items-center justify-between">
              <span className="text-muted-foreground">Assigned Panel Member:</span>
              <span className="font-semibold text-slate-900">
                {selectedPanel === "auto" ? "Auto (From each candidate's row)" : selectedPanel}
              </span>
            </div>

            {bulkSending && (
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%` }}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSending}>
              Cancel
            </Button>
            <Button onClick={sendBulk} disabled={bulkSending || eligibleCount === 0}
              className="bg-blue-600 hover:bg-blue-700">
              {bulkSending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />Sending {bulkProgress.current} of {bulkProgress.total}…</>
              ) : (
                <><Mail className="h-3.5 w-3.5 mr-2" />Send {eligibleCount} Letters</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
