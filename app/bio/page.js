"use client";

import { useState } from "react";
import Link from "next/link";
import BioIntakeForm from "@/components/bio/BioIntakeForm";
import ReportView from "@/components/bio/ReportView";
import { generateUUID } from "@/lib/generateUUID";

const EMPTY_FORM = {
  drugName: "",
  company: "",
  indication: "",
  target: "",
  mechanism: "",
  modality: "",
  phase: "",
  trialSize: "",
  primaryEndpoint: "",
  patientPopulation: "",
  safetySignals: "",
  priorResults: "",
  prevalence: "",
  diagnosedPopulation: "",
  geography: "",
  standardOfCare: "",
  competingTherapies: "",
  priceAssumption: "",
  fdaOrphan: "",
  fdaFastTrack: "",
  fdaBreakthrough: "",
  emaOrphan: "",
  regulatoryNotes: "",
};

export default function BioPage() {
  const [view, setView] = useState("form"); // form | loading | report | error
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [report, setReport] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [conversationId, setConversationId] = useState(null);

  function handleNext() {
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    setView("loading");
    setErrorMsg("");
    const newConversationId = generateUUID();
    setConversationId(newConversationId);
    try {
      const res = await fetch("/api/bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "report",
          form: formData,
          conversationId: newConversationId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error || "Something went wrong generating the report."
        );
      }

      const data = await res.json();
      setReport(data.report);
      setView("report");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErrorMsg(e.message || "Something went wrong. Please try again.");
      setView("error");
    }
  }

  function handleStartOver() {
    setFormData(EMPTY_FORM);
    setStep(1);
    setReport("");
    setConversationId(null);
    setView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen border-t-4 border-gold bg-white text-slate-800">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">
          &larr; OAI Nexus
        </Link>

        <h1 className="mt-3 text-3xl font-semibold text-slate-900">
          Nexus Diligence
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Orphan Drug Intelligence Evaluator
        </p>

        <div className="mt-10">
          {view === "form" && (
            <BioIntakeForm
              step={step}
              formData={formData}
              setFormData={setFormData}
              onNext={handleNext}
              onBack={handleBack}
              onSubmit={handleSubmit}
            />
          )}

          {view === "loading" && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 animate-pulseDot rounded-full bg-gold [animation-delay:-0.32s]" />
                <span className="h-3 w-3 animate-pulseDot rounded-full bg-gold [animation-delay:-0.16s]" />
                <span className="h-3 w-3 animate-pulseDot rounded-full bg-gold" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                Generating Orphan Drug Intelligence Report...
              </p>
            </div>
          )}

          {view === "error" && (
            <div className="mx-auto max-w-xl">
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
              <button
                onClick={() => setView("form")}
                className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Back to form
              </button>
            </div>
          )}

          {view === "report" && (
            <ReportView
              report={report}
              formData={formData}
              onStartOver={handleStartOver}
              conversationId={conversationId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
