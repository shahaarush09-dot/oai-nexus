"use client";

import { useMemo } from "react";
import SearchDropdown from "@/components/intelligence/SearchDropdown";
import AlphabetBrowse from "@/components/intelligence/AlphabetBrowse";
import DataTable from "@/components/intelligence/DataTable";
import EntityCell from "@/components/intelligence/EntityCell";
import StageBadge from "@/components/intelligence/StageBadge";
import DetailShell, { MapLoading, Section } from "@/components/intelligence/DetailShell";
import AskNexusPopover from "@/components/intelligence/AskNexusPopover";
import { useAskTarget } from "@/components/intelligence/useAskTarget";
import { useMapData } from "@/components/intelligence/useMapData";
import { normalizeKey } from "@/lib/loadIntelligenceData";
import { rollUp } from "@/lib/intelligenceAggregate";
import { stageRank } from "@/lib/stages";

export default function CompaniesTab({ data, selected, onSelect, onNavigate, onBuildView }) {
  if (!selected) {
    return (
      <div>
        <SearchDropdown mode="company" records={data?.companies} onSelect={onSelect} />
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
          Or browse alphabetically
        </p>
        <div className="mt-4">
          <AlphabetBrowse
            records={data?.companies}
            nameField="companyName"
            metaField="productCount"
            onSelect={onSelect}
          />
        </div>
      </div>
    );
  }
  return <CompanyDetail company={selected} onBack={() => onSelect(null)} onNavigate={onNavigate} onBuildView={onBuildView} />;
}

function CompanyDetail({ company, onBack, onNavigate, onBuildView }) {
  const { askTarget, openAsk, closeAsk } = useAskTarget();
  const { data: map, loading, error } = useMapData();

  const rows = useMemo(() => {
    if (!map) return [];
    return map.byCompany.get(normalizeKey(company.companyName)) || [];
  }, [map, company]);

  const diseases = useMemo(
    () => rollUp(rows, "diseaseName", { countField: "productName", labelField: "category" }),
    [rows]
  );
  const products = useMemo(
    () => rollUp(rows, "productName", { countField: "diseaseName", labelField: "mechanism" }),
    [rows]
  );

  // The export carries no ticker or public/private flag, so the plan's
  // "public company" badge has nothing to render from. These are the
  // fields that do exist.
  const facts = [
    { label: "Diseases", value: company.diseaseCount?.toLocaleString("en-US") },
    { label: "Products", value: company.productCount?.toLocaleString("en-US") },
    { label: "Map links", value: company.linkCount?.toLocaleString("en-US") },
    { label: "Clinical trials", value: company.trialCount?.toLocaleString("en-US") },
    {
      label: "Most advanced stage",
      value: <StageBadge stage={company.mostAdvancedStage} />,
    },
    {
      label: "Has approved product",
      value:
        company.hasApprovedProduct === "Yes" ? (
          <span className="text-teal">Yes</span>
        ) : (
          <span className="text-slate-400">No</span>
        ),
    },
    { label: "Sources", value: company.sources },
  ];

  return (
    <DetailShell
      eyebrow="Company"
      title={company.companyName}
      facts={facts}
      onBack={onBack}
      onBuildView={onBuildView}
      backLabel="All companies"
    >
      {loading || error ? (
        <MapLoading error={error} />
      ) : (
        <>
          <Section title="Diseases this company works on" count={diseases.length}>
            <DataTable
              rows={diseases}
              emptyMessage="No diseases linked to this company."
              columns={[
                {
                  key: "name",
                  header: "Disease",
                  render: (r) => (
                    <EntityCell name={r.name} onSelect={() => onNavigate("disease", r.name)} onAskNexus={(n, el) => openAsk("disease", n, el)} />
                  ),
                },
                {
                  key: "label",
                  header: "Category",
                  render: (r) => <span className="text-slate-400">{r.label || "—"}</span>,
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

          <Section title="Products this company makes" count={products.length}>
            <DataTable
              rows={products}
              emptyMessage="No products linked to this company."
              columns={[
                {
                  key: "name",
                  header: "Product",
                  render: (r) => (
                    <EntityCell name={r.name} onSelect={() => onNavigate("drug", r.name)} onAskNexus={(n, el) => openAsk("drug", n, el)} />
                  ),
                },
                { key: "count", header: "Diseases", align: "right" },
                {
                  key: "stage",
                  header: "Stage",
                  sortValue: (r) => stageRank(r.stage),
                  render: (r) => <StageBadge stage={r.stage} />,
                },
                {
                  key: "label",
                  header: "Mechanism",
                  render: (r) => <span className="text-slate-400">{r.label || "—"}</span>,
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
