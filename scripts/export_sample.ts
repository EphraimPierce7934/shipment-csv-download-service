import { createShipmentExport, exportRequestSchema } from "../src/shipment_csv_export";

const request = exportRequestSchema.parse({
  reportId: "dispatch-2026-08-15",
  shipments: [
    {
      shipmentId: "SHP-1042",
      carrier: "Northline",
      destination: "Shanghai DC",
      events: [
        { occurredAt: "2026-08-15T01:15:00.000Z", code: "picked_up", location: "Suzhou Hub" },
        { occurredAt: "2026-08-15T05:20:00.000Z", code: "delivered", location: "Shanghai DC", note: "Dock 4" }
      ],
      proofOfDelivery: [{ name: "signed-receipt.pdf", objectKey: "pod/SHP-1042/receipt.pdf" }]
    }
  ]
});

console.log(await createShipmentExport(request));
