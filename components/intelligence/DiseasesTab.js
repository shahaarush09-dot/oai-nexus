"use client";

import { useMemo } from "react";
import SearchDropdown from "@/components/intelligence/SearchDropdown";
import AlphabetBrowse from "@/components/intelligence/AlphabetBrowse";
import DataTable from "@/components/intelligence/DataTable";
import EntityCell from "@/components/intelligence/EntityCell";
import StageBadge from "@/components/intelligence/StageBadge";
import StageDistributionChart from "@/components/intelligence/StageDistributionChart";
import DetailShell, { MapLoading, Section } from "@/components/intelligence/DetailShell";
import AskNexusPopover from "@/components/intelligence/AskNexusPopover";
import { useAskTarget } from "@/components/intelligence/useAskTarget";
import { useMapData } from "@/components/intelligence/useMapData";
import { normalizeKey } from "@/lib/loadIntelligenceData";
import { rollUp } from "@/lib/intelligenceAggregate";
import { stageRank } from "@/lib/stages";

export default function DiseasesTab({ data, selected, onSelect, onNavigate, onBuildView }) {
  if (!selected) {
    return (
      <div>
        <SearchDropdown mode="disease" records={data?.diseases} onSelect={onSelect} />
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
          Or browse alphabetically
        </p>
        <div className="mt-4">
          <AlphabetBrowse
            records={data?.diseases}
            nameField="diseaseName"
            metaField="productCount"
            onSelect={onSelect}
          />
        </div>
      </div>
    );
  }
  return <DiseaseDetail disease={selected} onBack={() => onSelect(null)} onNavigate={onNavigate} onBuildView={onBuildView} />;
}

function DiseaseDetail({ disease, onBack, onNavigate, onBuildView }) {
  const { askTarget, openAsk, closeAsk } = useAskTarget();
  const { data: map, loading, error } = useMapData();

  const rows = useMemo(() => {
    if (!map) return [];
    return map.byDisease.get(normalizeKey(disease.diseaseName)) || [];
  }, [map, disease]);

  const companies = useMemo(
    () => rollUp(rows, "companyName", { countField: "productName" }),
    [rows]
  );
  const products = useMemo(
    () => rollUp(rows, "productName", { countField: "companyName", labelField: "mechanism" }),
    [rows]
  );

  const facts = [
    { label: "ORPHA code", value: disease.orphaCode },
    { label: "Category", value: disease.category },
    {
      label: "Prevalence",
      value: disease.prevalence
        ? `${disease.prevalence}${disease.prevalenceType ? ` (${disease.prevalenceType})` : ""}`
        : null,
    },
    { label: "ICD-10", value: disease.icd10 },
    { label: "OMIM", value: disease.omim },
    { label: "Disorder type", value: disease.disorderType },
    {
      label: "Most advanced stage",
      value: <StageBadge stage={normalizeStage(disease.mostAdvancedStage)} />,
    },
    { label: "Clinical trials", value: disease.trialCount?.toLocaleString("en-US") },
    {
      label: "FDA orphan designations",
      value: disease.fdaDesignationCount?.toLocaleString("en-US"),
    },
  ];

  return (
    <DetailShell
      eyebrow="Disease"
      title={disease.diseaseName}
      facts={facts}
      onBack={onBack}
      onBuildView={onBuildView}
      backLabel="All diseases"
    >
      {disease.description && (
        <p className="mt-6 max-w-3xl text-sm font-light leading-relaxed text-slate-400">
          {disease.description}
        </p>
      )}
      {disease.synonyms && (
        <p className="mt-3 max-w-3xl text-xs font-light leading-relaxed text-slate-500">
          <span className="font-mono uppercase tracking-[0.16em] text-slate-600">
            Also known as{" "}
          </span>
          {disease.synonyms}
        </p>
      )}

      {loading || error ? (
        <MapLoading error={error} />
      ) : (
        <>
          {rows.length > 0 && (
            <div className="mt-8 max-w-md">
              <StageDistributionChart rows={rows} />
            </div>
          )}

          <Section title="Companies" count={companies.length}>
            <DataTable
              rows={companies}
              emptyMessage="No companies linked to this disease."
              columns={[
                {
                  key: "name",
                  header: "Company",
                  render: (r) => (
                    <EntityCell name={r.name} onSelect={() => onNavigate("company", r.name)} onAskNexus={(n, el) => openAsk("company", n, el)} />
                  ),
                },
                { key: "count", header: "Products", align: "right" },
                {
                  key: "stage",
                  header: "Most advanced",
                  sortValue: (r) => stageRank(r.stage),
                  render: (r) => <StageBadge stage={r.stage} />,
                },
              ]}
            />
          </Section>

          <Section title="Products" count={products.length}>
            <DataTable
              rows={products}
              emptyMessage="No products linked to this disease."
              columns={[
                {
                  key: "name",
                  header: "Product",
                  render: (r) => (
                    <EntityCell name={r.name} onSelect={() => onNavigate("drug", r.name)} onAskNexus={(n, el) => openAsk("drug", n, el)} />
                  ),
                },
                { key: "count", header: "Companies", align: "right" },
                {
                  key: "stage",
                  header: "Stage",
                  sortValue: (r) => stageRank(r.stage),
                  render: (r) => <StageBadge stage={r.stage} />,
                },
                {
                  key: "label",
                  header: "Mechanism",
                  render: (r) =>
                    r.label ? (
                      <span className="text-slate-400">{r.label}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    ),
                },
              ]}
            />
          </Section>
        </>
      )}
      <AskNexusPopover target={askTarget} onClose={closeAsk} onOpenDetail={onNavigate} />
    </DetailShell>
  );
}

// diseases.json writes "None found" where the pipeline located no linked
// product at all; the badge vocabulary has no such stage, and rendering
// it as an unknown badge would imply a pipeline that doesn't exist.
function normalizeStage(stage) {
  return stage === "None found" ? null : stage;
}
