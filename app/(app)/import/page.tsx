import ModuleHeader from "@/components/ModuleHeader";

export default function ImportPage() {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm md:p-5">
      <ModuleHeader
        title="Import"
        description="Track and process inbound shipments and customs entries."
      />
      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-10 text-center">
        <p className="text-xs text-zinc-500">
          Import module — content coming soon.
        </p>
      </div>
    </div>
  );
}
