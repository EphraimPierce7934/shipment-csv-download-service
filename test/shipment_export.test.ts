import assert from "node:assert/strict";
import test from "node:test";
import { exportRequestSchema, renderShipmentCsv } from "../src/shipment_csv_export";

test("an unresolved delivery exception is visible in the CSV decision column", () => {
  const input = exportRequestSchema.parse({
    reportId: "morning-dispatch",
    shipments: [{
      shipmentId: "SHP-9",
      carrier: "Northline",
      destination: "Hangzhou Store",
      events: [{ occurredAt: "2026-08-15T03:00:00.000Z", code: "exception", location: "Hangzhou", note: "" }],
      proofOfDelivery: [],
      exception: { reason: "Recipient unavailable" }
    }]
  });

  const csv = renderShipmentCsv(input);
  assert.match(csv, /SHP-9,Northline,Hangzhou Store,exception,Hangzhou,needs_attention,.*,Recipient unavailable/);
});
