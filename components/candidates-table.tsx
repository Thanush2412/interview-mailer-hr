"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  Columns3, Mail, CheckSquare,
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
    const match = headers.find((h) => h.toLowerCase() === key);
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

const getEmail          = mkGet("email",          ["candidate mail id", "mail id", "to", "email", "recipient", "email address", "to email"]);
const getName           = mkGet("name",           ["candidate name", "name", "full name", "candidate"]);
const getId             = mkGet("candidateId",    ["candidate id", "candidateid", "id", "candidate_id"]);
const getType           = mkGet("interviewType",  ["mode of interview", "interview type", "type", "mode", "interview mode"]);
const getDate           = mkGet("date",           ["interview scheduled date", "interview date", "date", "scheduled date"]);
const getTime           = mkGet("time",           ["time", "interview time", "scheduled time", "reporting time"]);
const getLink           = mkGet("meetingLink",    ["meeting link", "link", "meet link", "zoom link", "teams link"]);
const getJob            = mkGet("jobTitle",       ["role interviewed for", "name of the role", "job title", "position", "role", "designation"]);
const getEvaluator      = mkGet("evaluatorName",  ["interview evaluator", "evaluator", "interviewer", "interviewer name"]);
const getEvaluatorEmail = mkGet("evaluatorEmail", ["interviewer email", "evaluator email", "interviewer mail", "evaluator mail"]);
const getEmailStatus    = (r: Candidate, h: string[], m: ColumnMapping) =>
  getMapped(r, m["emailStatus"], ["email status", "mail sent status", "status"], h);

// ── email templates ────────────────────────────────────────────────────────────
type Template = { subject: string; body: string; candidateId: string };

function buildTemplate(type: string, row: Candidate, headers: string[], mapping: ColumnMapping): Template | null {
  const name        = getName(row, headers, mapping) || "Candidate";
  const candidateId = getId(row, headers, mapping);
  const date        = getDate(row, headers, mapping);
  const time        = getTime(row, headers, mapping);
  const link        = getLink(row, headers, mapping);
  const jobTitle    = getJob(row, headers, mapping);
  const evaluator   = getEvaluator(row, headers, mapping);
  const t           = type.toLowerCase().trim();

  // ── Client Interview (Virtual) ──────────────────────────────────────────────
  if (t === "client" || t === "client interview" || t === "virtual client") {
    return {
      subject: "FACE Prep | Interview Call Letter – Virtual Interview with Client",
      candidateId,
      body: `Dear ${name},

As part of the next stage of the process, you will be meeting one of our clients who is a senior academician. Please ensure that you are well prepared for this interaction and present yourself professionally.

Interview Details
Date: ${date || "[Insert Date]"}
Time: ${time || "[Insert Time]"}
Mode: Virtual (Online)${evaluator ? `\nInterviewer: ${evaluator}` : ""}${link ? `\nMeeting Link: ${link}` : ""}

Kindly follow the instructions below:

1. Be Punctual
Please join the meeting 10 minutes before the scheduled time to avoid any delays.

2. Professional Appearance
Ensure you are dressed in formal attire and maintain a professional appearance throughout the meeting.

3. Understand FACE Prep and the Role
Take some time to familiarize yourself with:
- FACE Prep and the services we provide
- The role you have applied for
- How your experience aligns with the responsibilities

4. Be Clear and Concise in Communication
Since the client is a senior academician, please ensure that:
- Your responses are clear, structured, and respectful
- You listen carefully before responding
- You avoid casual language

5. Demonstrate Preparation
Be ready to discuss:
- Your background and experience
- Your understanding of the role
- Why you are interested in working with FACE Prep

6. Maintain Professional Etiquette
- Address the client respectfully
- Allow the interviewer to complete their question before answering
- Keep your responses focused and relevant

7. Technical Readiness (for virtual meetings)
Please ensure:
- Stable internet connection
- Working microphone and camera
- Quiet environment without disturbances

We encourage you to treat this interaction with the same seriousness as a formal interview. Being prepared will help you make a strong impression.

We request you to kindly acknowledge this email and confirm your availability for the scheduled interview.

Wishing you the very best for the discussion.`,
    };
  }

  // ── In-Person Interview ─────────────────────────────────────────────────────
  if (t === "in-person" || t === "in person" || t === "offline" || t === "walk-in") {
    return {
      subject: "FACE Prep | Interview Call Letter",
      candidateId,
      body: `Dear ${name},

Greetings from FACE Prep!

We are pleased to inform you that you have been shortlisted for an interview with our team. Please find the details of your interview below and make the necessary arrangements to attend.

Interview Details
Date: ${date || "[Insert Date]"}
Reporting Time: ${time || "[Insert Time]"}
Mode: In-person Interview${evaluator ? `\nInterviewer: ${evaluator}` : ""}
Venue: No. 12, Lakshmi Nagar, Thottipalayam Pirivu, Off Avinashi Road, Coimbatore, Tamil Nadu – 641014

Instructions for the Candidate
- A hard copy of your updated resume
- Please bring your laptop, as it may be required for technical assessments or practical rounds during the interview process.
- Kindly attend the interview in formal and professional attire.

We request you to kindly acknowledge this email and confirm your availability for the scheduled interview.

We look forward to meeting you in person and discussing how your skills and aspirations align with our organization's goals.`,
    };
  }

  // ── Virtual Interview (Internal) ────────────────────────────────────────────
  if (t === "virtual" || t === "online" || t === "zoom" || t === "teams" || t === "google meet") {
    return {
      subject: `FACE Prep | Interview Call Letter – ${jobTitle || "Position"}`,
      candidateId,
      body: `Greetings from FACE Prep!

We are pleased to inform you that the first round of interview for the position of ${jobTitle || "[Job Title]"} with our organization has been scheduled.

Your interview has been scheduled on ${date || "[Date]"} at ${time || "[Time]"}, and it will be conducted in virtual mode. Please find below the interview details and important guidelines to help you prepare for the session.

Interview Details
Mode: Virtual (Online)
Date: ${date || "[Insert Date]"}
Time: ${time || "[Insert Time]"}${evaluator ? `\nInterviewer: ${evaluator}` : ""}
Meeting Link: ${link || "[Insert Link]"}
Dress Code: Formal / Business Attire

Virtual Interview Guidelines

To ensure a smooth and professional interview experience, please follow the instructions below:

- The interview must be attended using a laptop. Use of mobile phones or tablets is not permitted.
- Keep your camera turned on throughout the interview and use a blurred or neutral background to maintain a professional appearance.
- Ensure you have a stable and high-speed internet connection to avoid disruptions during the session.
- Attend the interview from a quiet and well-lit location. Please minimize background noise or interruptions.
- Dress in formal and presentable clothing as you would for an in-person interview.
- Join the virtual meeting at least 10 minutes before the scheduled time to check your audio, video, and connection settings.

We request you to kindly acknowledge this email and confirm your availability for the scheduled interview.`,
    };
  }

  return null;
}

// ── badges ─────────────────────────────────────────────────────────────────────
function TypeBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  if (v.includes("client"))   return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200">Client</Badge>;
  if (v.includes("virtual") || v.includes("online") || v.includes("zoom"))
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Virtual</Badge>;
  if (v.includes("in-person") || v.includes("offline") || v.includes("walk"))
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">In-Person</Badge>;
  return <Badge variant="secondary">{value || "—"}</Badge>;
}

function EmailStatusBadge({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  if (value.startsWith("✓")) return <span className="text-green-600 text-xs font-medium flex items-center gap-1"><CheckSquare className="h-3 w-3" />{value}</span>;
  if (value.startsWith("✗")) return <span className="text-red-500 text-xs font-medium">{value}</span>;
  if (value === "Skipped")   return <span className="text-muted-foreground text-xs">Skipped</span>;
  return <span className="text-xs">{value}</span>;
}

const TYPE_COLS   = new Set(["mode of interview", "interview type", "type", "mode", "interview mode"]);
const HIDDEN_SYSTEM = new Set(["email status", "_rowindex"]);

const KNOWN_TYPES = new Set([
  "client", "client interview", "virtual client",
  "in-person", "in person", "offline", "walk-in",
  "virtual", "online", "zoom", "teams", "google meet",
]);

// ── main component ─────────────────────────────────────────────────────────────
export default function CandidatesTable({ sheetUrl, columnMapping = {} }: { sheetUrl: string; columnMapping?: ColumnMapping }) {
  const [headers, setHeaders]           = useState<string[]>([]);
  const [allRows, setAllRows]           = useState<Candidate[]>([]);
  const [loading, setLoading]           = useState(false);
  const [sending, setSending]           = useState<Record<number, boolean>>({});
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [pageSize, setPageSize]         = useState(20);
  const [visibleCols, setVisibleCols]   = useState<Set<string>>(new Set());
  const [colsInit, setColsInit]         = useState(false);
  const [selected, setSelected]         = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen]         = useState(false);
  const [bulkSending, setBulkSending]   = useState(false);
  const [typeFilter, setTypeFilter]     = useState<string>("all");
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  // Reset state when sheetUrl changes
  useEffect(() => {
    setColsInit(false);
    setVisibleCols(new Set());
    setAllRows([]);
    setHeaders([]);
    setPage(1);
    setSelected(new Set());
    setTypeFilter("all");
  }, [sheetUrl]);

  const fetchData = useCallback(async () => {
    if (!sheetUrl) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/sheet?url=${encodeURIComponent(sheetUrl)}`);
      const json: SheetResponse = await res.json();
      if (json.status === "success") {
        setHeaders(json.headers);
        setAllRows([...json.data].reverse());
        setPage(1);
        setSelected(new Set());
        if (!colsInit) {
          setVisibleCols(new Set(json.headers.filter((h) => !HIDDEN_SYSTEM.has(h.toLowerCase()) && h.trim() !== "")));
          setColsInit(true);
        }
      } else {
        toast.error(json.message || "Failed to load sheet data");
      }
    } catch {
      toast.error("Network error loading sheet");
    } finally {
      setLoading(false);
    }
  }, [sheetUrl, colsInit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectableHeaders = useMemo(
    () => headers.filter((h) => !HIDDEN_SYSTEM.has(h.toLowerCase()) && h.trim() !== ""),
    [headers]
  );
  const emailStatusHeader = useMemo(() => {
    // Use mapped column if set, otherwise find by known names
    if (columnMapping.emailStatus) return columnMapping.emailStatus;
    return headers.find((h) => ["email status", "mail sent status"].includes(h.toLowerCase()));
  }, [headers, columnMapping]);

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

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageRows   = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ── stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = allRows.length;
    const sent    = allRows.filter((r) => {
      const s = emailStatusHeader ? String(r[emailStatusHeader] ?? "") : "";
      return s.startsWith("✓ Sent");
    }).length;
    const failed  = allRows.filter((r) => {
      const s = emailStatusHeader ? String(r[emailStatusHeader] ?? "") : "";
      return s.startsWith("✗");
    }).length;
    const pending = allRows.filter((r) => {
      const email  = getEmail(r, headers, columnMapping);
      const type   = getType(r, headers, columnMapping).toLowerCase().trim();
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
    const email  = getEmail(row, headers, columnMapping);
    const type   = getType(row, headers, columnMapping).toLowerCase().trim();
    const status = emailStatusHeader ? String(row[emailStatusHeader] ?? "") : "";
    return !!email && KNOWN_TYPES.has(type) && !status.startsWith("✓ Sent");
  }

  // ── send single ──────────────────────────────────────────────────────────────
  async function sendEmail(row: Candidate) {
    const email = getEmail(row, headers, columnMapping);
    if (!email) return;
    const type     = getType(row, headers, columnMapping);
    const template = buildTemplate(type, row, headers, columnMapping);
    if (!template) {
      toast.error(`Unknown interview type: "${type}". Use: Client, Virtual, or In-Person.`);
      return;
    }
    setSending((s) => ({ ...s, [row._rowIndex]: true }));
    try {
      const res  = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetUrl,
          rowIndex:       row._rowIndex,
          to:             email,
          subject:        template.subject,
          body:           template.body,
          candidateId:    template.candidateId,
          candidateName:  getName(row, headers, columnMapping),
          cc:             row["CC"] || row["cc"] || "",
          sender_name:    "Talent Acquisition Team",
          evaluatorEmail: getEvaluatorEmail(row, headers, columnMapping),
          evaluatorName:  getEvaluator(row, headers, columnMapping),
          jobTitle:       getJob(row, headers, columnMapping),
          date:           getDate(row, headers, columnMapping),
          time:           getTime(row, headers, columnMapping),
          link:           getLink(row, headers, columnMapping),
          interviewType:  type,
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
    for (const row of rows) {
      const email    = getEmail(row, headers, columnMapping);
      const type     = getType(row, headers, columnMapping);
      const template = buildTemplate(type, row, headers, columnMapping);
      if (!template) { failed++; errors.push(email || `row ${row._rowIndex}`); setBulkProgress((p) => ({ ...p, current: p.current + 1 })); continue; }
      try {
        const res  = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetUrl,
            rowIndex:       row._rowIndex,
            to:             email,
            subject:        template.subject,
            body:           template.body,
            candidateId:    template.candidateId,
            candidateName:  getName(row, headers, columnMapping),
            cc:             row["CC"] || row["cc"] || "",
            sender_name:    "Talent Acquisition Team",
            evaluatorEmail: getEvaluatorEmail(row, headers, columnMapping),
            evaluatorName:  getEvaluator(row, headers, columnMapping),
            jobTitle:       getJob(row, headers, columnMapping),
            date:           getDate(row, headers, columnMapping),
            time:           getTime(row, headers, columnMapping),
            link:           getLink(row, headers, columnMapping),
            interviewType:  type,
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

  const displayHeaders  = selectableHeaders.filter((h) => visibleCols.has(h));
  const eligibleCount   = allRows.filter((r) => selected.has(r._rowIndex) && canSendRow(r)).length;

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
          {loading ? "Loading…" : `${filtered.length} candidates`}
        </span>
      </div>

      {/* Stats bar */}
      {allRows.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
            { label: "Pending", value: stats.pending, color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
            { label: "Sent", value: stats.sent, color: "text-green-700", bg: "bg-green-50 border-green-200" },
            { label: "Failed", value: stats.failed, color: "text-red-700", bg: "bg-red-50 border-red-200" },
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
                  const email       = getEmail(row, headers, columnMapping);
                  const type        = getType(row, headers, columnMapping);
                  const emailStatus = emailStatusHeader ? String(row[emailStatusHeader] ?? "") : "";
                  const alreadySent = emailStatus.startsWith("✓ Sent");
                  const sendable    = canSendRow(row);

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
                              if (window.confirm(`Send interview call letter to ${email}?`)) {
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
            Page {page} of {totalPages} · {filtered.length} rows
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
            <p className="text-sm text-muted-foreground">
              Already-sent rows and rows without an interview type will be skipped automatically.
            </p>
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
