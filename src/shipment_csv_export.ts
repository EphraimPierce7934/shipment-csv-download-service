import { createHash } from "node:crypto";
import { z } from "zod";
import { infrai } from "./infrai_storage";

const shipmentEventSchema = z.object({
  occurredAt: z.string().datetime(),
  code: z.enum(["picked_up", "in_transit", "delivered", "exception"]),
  location: z.string().min(1),
  note: z.string().default(""),
});

const proofOfDeliverySchema = z.object({
  name: z.string().min(1),
  objectKey: z.string().min(1),
});

const shipmentSchema = z.object({
  shipmentId: z.string().min(1),
  carrier: z.string().min(1),
  destination: z.string().min(1),
  events: z.array(shipmentEventSchema).min(1),
  proofOfDelivery: z.array(proofOfDeliverySchema).default([]),
  exception: z.object({ reason: z.string().min(1), resolvedAt: z.string().datetime().optional() }).optional(),
});

export const exportRequestSchema = z.object({
  reportId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  shipments: z.array(shipmentSchema).min(1),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;

export function shipmentDecision(shipment: ExportRequest["shipments"][number]): string {
  if (shipment.exception && !shipment.exception.resolvedAt) return "needs_attention";
  if (shipment.events.some((event) => event.code === "delivered")) return "delivered";
  return "moving";
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function renderShipmentCsv(input: ExportRequest): string {
  const headings = [
    "shipment_id", "carrier", "destination", "latest_event", "latest_location",
    "delivery_state", "pod_files", "exception_reason",
  ];
  const rows = input.shipments.map((shipment) => {
    const latest = [...shipment.events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
    return [
      shipment.shipmentId,
      shipment.carrier,
      shipment.destination,
      latest.code,
      latest.location,
      shipmentDecision(shipment),
      shipment.proofOfDelivery.map((file) => `${file.name}:${file.objectKey}`).join(";"),
      shipment.exception?.reason ?? "",
    ].map(csvCell).join(",");
  });
  return [headings.join(","), ...rows].join("\n") + "\n";
}

export async function createShipmentExport(input: ExportRequest): Promise<{ downloadUrl: string; objectKey: string }> {
  const bucket = process.env.INFRAI_EXPORT_BUCKET ?? "shipment-reports";
  const objectKey = `exports/${input.reportId}.csv`;
  const csv = renderShipmentCsv(input);
  const idempotencyKey = createHash("sha256").update(`${input.reportId}:${csv}`).digest("hex");

  await infrai.storage.bucket.create(bucket);
  const upload = await infrai.storage.object.presign(bucket, objectKey, {
    op: "put",
    expires_seconds: 300,
    content_type: "text/csv; charset=utf-8",
    idempotency_key: idempotencyKey,
  });
  const uploadResponse = await fetch(upload.url, {
    method: "PUT",
    headers: { "Content-Type": "text/csv; charset=utf-8" },
    body: csv,
  });
  if (!uploadResponse.ok) throw new Error(`CSV upload failed (${uploadResponse.status})`);

  const download = await infrai.storage.object.presign(bucket, objectKey, {
    op: "get",
    expires_seconds: 900,
    response_disposition: `attachment; filename="${input.reportId}.csv"`,
  });
  return { downloadUrl: download.url, objectKey };
}
