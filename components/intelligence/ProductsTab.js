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
import { rollUp, relatedProducts } from "@/lib/intelligenceAggregate";
import { stageRank } from "@/lib/stages";

export default function ProductsTab({ data, selected, onSelect, onNavigate, onBuildView }) {
  if (!selected) {
    return (
      <div>
        <SearchDropdown mode="drug" records={data?.products} onSelect={onSelect} />
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
          Or browse alphabetically
        </p>
        <div className="mt-4">
          <AlphabetBrowse
            records={data?.products}
            nameField="productName"
            metaField="developmentStage"
            onSelect={onSelect}
          />
        </div>
      </div>
    );
  }
  return <ProductDetail product={selected} onBack={() => onSelect(null)} onNavigate={onNavigate} onBuildView={onBuildView} />;
}

function ProductDetail({ product, onBack, onNavigate, onBuildView }) {
  const { askTarget, openAsk, closeAsk } = useAskTarget();
  const { data: map, loading, error } = useMapData();

  const rows = useMemo(() => {
    if (!map) return [];
    return map.byProduct.get(normalizeKey(product.productName)) || [];
  }, [map, product]);

  const diseases = useMemo(
    () => rollUp(rows, "diseaseName", { countField: "companyName", labelField: "category" }),
    [rows]
  );
  const companies = useMemo(
    () => rollUp(rows, "companyName", { countField: "diseaseName" }),
    [rows]
  );
  const related = useMemo(() => {
    if (!map) return { items: [], capped: false };
    return relatedProducts(
      map.byCompany,
      companies.map((c) => c.name),
      product.productName
    );
  }, [map, companies, product]);

  // No generic name, modality, or breakthrough-therapy flag exists in the
  // export, so the plan's badges for those have nothing behind them yet.
  const facts = [
    { label: "Development stage", value: <StageBadge stage={product.developmentStage} /> },
    { label: "Mechanism", value: product.mechanism },
    {
      label: "FDA approved",
      value:
        product.fdaApproved === "Yes" ? (
          <span className="text-teal">Yes</span>
        ) : (
          <span className="text-slate-400">No</span>
        ),
    },
    { label: "Approval date", value: product.approvalDate },
    { label: "Diseases", value: product.diseaseCount?.toLocaleString("en-US") },
    { label: "Companies", value: product.companyCount?.toLocaleString("en-US") },
    { label: "Clinical trials", value: product.trialCount?.toLocaleString("en-US") },
    { label: "Sources", value: product.sources },
  ];

  return (
    <DetailShell
      eyebrow="Product"
      title={product.productName}
      facts={facts}
      onBack={onBack}
      onBuildView={onBuildView}
      onAskNexus={(el) => openAsk("drug", product.productName, el)}
      backLabel="All products"
    >
      {loading || error ? (
        <MapLoading error={error} />
      ) : (
        <>
          <Section title="Target diseases" count={diseases.length}>
            <DataTable
              rows={diseases}
              emptyMessage="No diseases linked to this product."
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
                { key: "count", header: "Companies", align: "right" },
                {
                  key: "stage",
                  header: "Stage",
                  sortValue: (r) => stageRank(r.stage),
                  render: (r) => <StageBadge stage={r.stage} />,
                },
              ]}
            />
          </Section>

          <Section title="Companies" count={companies.length}>
            <DataTable
              rows={companies}
              emptyMessage="No companies linked to this product."
              columns={[
                {
                  key: "name",
                  header: "Company",
                  render: (r) => (
                    <EntityCell name={r.name} onSelect={() => onNavigate("company", r.name)} onAskNexus={(n, el) => openAsk("company", n, el)} />
                  ),
                },
                { key: "count", header: "Diseases", align: "right" },
                {
                  key: "stage",
                  header: "Most advanced",
                  sortValue: (r) => stageRank(r.stage),
                  render: (r) => <StageBadge stage={r.stage} />,
                },
              ]}
            />
          </Section>

          <Section title="Related products" count={related.items.length}>
            {related.capped && (
              <p className="mb-3 text-xs font-light text-slate-500">
                Partial list — this product is linked to too many companies to
                walk exhaustively.
              </p>
            )}
            <DataTable
              rows={related.items}
              emptyMessage="No related products found."
              columns={[
                {
                  key: "name",
                  header: "Product",
                  render: (r) => (
                    <EntityCell name={r.name} onSelect={() => onNavigate("drug", r.name)} onAskNexus={(n, el) => openAsk("drug", n, el)} />
                  ),
                },
                {
                  key: "company",
                  header: "From company",
                  render: (r) => (
                    <EntityCell name={r.company} onSelect={() => onNavigate("company", r.company)} onAskNexus={(n, el) => openAsk("company", n, el)} />
                  ),
                },
                {
                  key: "stage",
                  header: "Stage",
                  sortValue: (r) => stageRank(r.stage),
                  render: (r) => <StageBadge stage={r.stage} />,
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
