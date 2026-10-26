"use client";

import FileInputWithClip from "@/components/import/FileInputWithClip";
import ImportDocumentLink from "@/components/import/ImportDocumentLink";
import {
  clearImportNamedAttachment,
  saveImportNamedAttachment,
  type ImportNamedAttachmentField,
} from "@/lib/freightForward/freightForward";
import { uploadDocument } from "@/lib/kyc/uploadDocument";
import { FreightForward, FreightForwardDocument } from "@/types/freightForward";

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
  const doc = item[field] as FreightForwardDocument | undefined;
  return (
    <div className="text-xs">
      <p className="font-medium text-zinc-700">{label}</p>
      {doc?.url ? (
        <ImportDocumentLink
          label={label}
          doc={doc}
          removeDisabled={disabled}
          onRemove={() => {
            if (!item.id || disabled) return;
            void (async () => {
              onUpdated(
                await clearImportNamedAttachment(item.id!, field, username)
              );
            })();
          }}
        />
      ) : (
        <FileInputWithClip
          disabled={disabled}
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
      )}
    </div>
  );
}
