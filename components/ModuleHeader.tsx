type ModuleHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export default function ModuleHeader({ title, description, action }: ModuleHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-sm font-semibold text-zinc-900">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
