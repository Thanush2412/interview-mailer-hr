"use client";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const FIELD_DEFINITIONS = [
  { key: "email",          label: "Candidate Email",   required: true,  hint: "Email address to send the call letter to" },
  { key: "name",           label: "Candidate Name",    required: true,  hint: "Used in the greeting line" },
  { key: "candidateId",    label: "Candidate ID",      required: false, hint: "Shown in the email header" },
  { key: "interviewType",  label: "Interview Type",    required: true,  hint: "Client / Virtual / In-Person" },
  { key: "date",           label: "Interview Date",    required: false, hint: "Shown in interview details" },
  { key: "time",           label: "Interview Time",    required: false, hint: "Shown in interview details" },
  { key: "jobTitle",       label: "Job Title / Role",  required: false, hint: "Used in subject and body" },
  { key: "meetingLink",    label: "Meeting Link",      required: false, hint: "Rendered as a Join Meeting button" },
  { key: "evaluatorName",  label: "Interviewer Name",  required: false, hint: "Shown in interview details" },
  { key: "evaluatorEmail", label: "Interviewer Email", required: false, hint: "Receives the evaluator notification" },
  { key: "emailStatus",    label: "Email Status Col",  required: false, hint: "Column where sent status is written back" },
] as const;

export type FieldKey = typeof FIELD_DEFINITIONS[number]["key"];
export type ColumnMapping = Partial<Record<FieldKey, string>>;

interface Props {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

const NONE = "__none__";

export default function ColumnMapper({ headers, mapping, onChange }: Props) {
  function set(key: FieldKey, value: string) {
    onChange({ ...mapping, [key]: value === NONE ? "" : value });
  }

  const requiredFields  = FIELD_DEFINITIONS.filter((f) => f.required);
  const optionalFields  = FIELD_DEFINITIONS.filter((f) => !f.required);

  return (
    <div className="space-y-5">
      {/* Required */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Required Fields
        </p>
        <div className="space-y-2">
          {requiredFields.map(({ key, label, hint }) => (
            <FieldRow
              key={key}
              fieldKey={key}
              label={label}
              hint={hint}
              required
              headers={headers}
              value={mapping[key] || NONE}
              onChange={set}
            />
          ))}
        </div>
      </div>

      <div className="border-t" />

      {/* Optional */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Optional Fields
        </p>
        <div className="space-y-2">
          {optionalFields.map(({ key, label, hint }) => (
            <FieldRow
              key={key}
              fieldKey={key}
              label={label}
              hint={hint}
              required={false}
              headers={headers}
              value={mapping[key] || NONE}
              onChange={set}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  fieldKey, label, hint, required, headers, value, onChange,
}: {
  fieldKey: FieldKey;
  label: string;
  hint: string;
  required: boolean;
  headers: string[];
  value: string;
  onChange: (key: FieldKey, value: string) => void;
}) {
  const isMapped = value && value !== NONE;

  return (
    <div className={`rounded-lg border p-3 transition-colors ${isMapped ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 leading-tight">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </p>
          <p className="text-xs text-slate-400 mt-0.5 leading-tight">{hint}</p>
        </div>
        <div className="shrink-0 w-44">
          <Select value={value} onValueChange={(v) => onChange(fieldKey, v ?? NONE)}>
            <SelectTrigger className={`h-8 text-xs ${isMapped ? "border-blue-300 bg-white" : ""}`}>
              <SelectValue placeholder="— not mapped —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} className="text-xs text-slate-400">
                — not mapped —
              </SelectItem>
              {headers.map((h) => (
                <SelectItem key={h} value={h} className="text-xs">
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
