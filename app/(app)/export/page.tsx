import ModuleHeader from "@/components/ModuleHeader";

export default function ExportPage() {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm md:p-5">
      <ModuleHeader
        title="Export"
        description="Handle outbound documentation and export compliance."
      />
      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-10 text-center">
        <p className="text-xs text-zinc-500">
          Export module — content coming soon.
        </p>
      </div>
    </div>
  );
}
