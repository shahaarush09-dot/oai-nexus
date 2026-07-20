"use client";

import { useState } from "react";
import { parseReportSections } from "@/lib/parseReport";
import BioFollowUpChat from "./BioFollowUpChat";

export default function ReportView({ report, formData, onStartOver, conversationId }) {
  const [copied, setCopied] = useState(false);
  const sections = parseReportSections(report);

  function handleCopy() {
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = (formData?.drugName || "orphan-drug-report")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    a.href = url;
    a.download = `${name || "orphan-drug-report"}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">
          Orphan Drug Intelligence Report
          {formData?.drugName ? ` — ${formData.drugName}` : ""}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {copied ? "Copied!" : "Copy report"}
          </button>
          <button
            onClick={handleDownload}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Download
          </button>
          <button
            onClick={onStartOver}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Start over
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {sections.map((s, i) => (
          <div key={i}>
            <h3 className="mb-2 border-b border-gold/40 pb-1 text-sm font-semibold uppercase tracking-wide text-gold-dark">
              {s.title}
            </h3>
            <div className="prose-chat text-sm leading-relaxed text-slate-700">
              {s.body.split(/\n\n+/).map((para, j) => (
                <p key={j}>{para}</p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="my-8 border-t border-slate-200" />

      <BioFollowUpChat report={report} conversationId={conversationId} />
    </div>
  );
}
