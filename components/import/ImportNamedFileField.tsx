"use client";

import FileInputWithClip from "@/components/import/FileInputWithClip";
import ImportDocumentLink from "@/components/import/ImportDocumentLink";
import {
  clearImportNamedAttachment,
  saveImportNamedAttachment,
  type ImportNamedAttachmentField,
} from "@/lib/freightForward/freightForward";
import { normalizeAttachments } from "@/lib/import/attachments";
import { uploadDocument } from "@/lib/kyc/uploadDocument";
import { FreightForward } from "@/types/freightForward";

export default function ImportNamedFileField({
  item,
  field,
  label,
  folder,
  username,
  disabled,
  onUpdated,
}: {
  item: FreightForward;
  field: ImportNamedAttachmentField;
  label: string;
  folder: string;
  username: string;
  disabled?: boolean;
  onUpdated: (item: FreightForward) => void;
}) {
  const docs = normalizeAttachments(item[field]);

  return (
    <div className="space-y-2 text-xs">
      <p className="font-medium text-zinc-700">{label}</p>
      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((doc, index) => (
            <ImportDocumentLink
              key={`${doc.url}-${index}`}
              label={`${label} ${docs.length > 1 ? index + 1 : ""}`.trim()}
              doc={doc}
              removeDisabled={disabled}
              onRemove={() => {
                if (!item.id || disabled) return;
                void (async () => {
                  onUpdated(
                    await clearImportNamedAttachment(
                      item.id!,
                      field,
                      username,
                      doc.url
                    )
                  );
                })();
              }}
            />
          ))}
        </div>
      )}
      <FileInputWithClip
        disabled={disabled}
        multiple
        onChange={(file) => {
          if (!file || !item.id) return;
          void (async () => {
            const uploaded = await uploadDocument(file, folder);
            onUpdated(
              await saveImportNamedAttachment(
                item.id!,
                field,
                { name: file.name, url: uploaded.url },
                username
              )
            );
          })();
        }}
      />
    </div>
  );
}
