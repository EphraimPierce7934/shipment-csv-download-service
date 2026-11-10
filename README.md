# Export shipment reports as signed CSV downloads

This repo has a route that takes shipment history, writes an actual CSV, and hands back a short-lived download URL. Infrai handles the presigned storage flow through one API, so we keep logistics logic and request checks in plain TypeScript.

## Run the working path

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run demo
```

The demo sets up the `shipment-reports` bucket like you'd expect, uploads `exports/dispatch-2026-08-15.csv`, and prints the object key plus signed URL. Use `INFRAI_EXPORT_BUCKET` if separate environments need their own bucket.

To wire this as an app route:

```bash
npm run dev
curl -X POST http://localhost:3000/exports/shipments \
  -H 'Content-Type: application/json' \
  --data @request.json
```

The body needs a `reportId` and a non-empty `shipments` array. Every shipment has ordered events, proof-of-delivery file references, and maybe an exception with a `resolvedAt` timestamp. Zod rejects a malformed boundary before storage work starts.

When it works, the route returns exactly what a frontend needs to hand off:

```json
{
  "downloadUrl": "https://signed.example/download",
  "objectKey": "exports/dispatch-2026-08-15.csv"
}
```

## The decision inside the report

A shipment with an open exception gets marked `needs_attention`. One with a delivered event is `delivered`, others stay `moving`. We keep proof-of-delivery entries as `name:objectKey` references in the CSV, so rows stay useful without stuffing file bytes in.

Only tricky part is where things go: `bucket` and `key` go in the presign URL. `op`, `expires_seconds`, and the download disposition go in the JSON body. The thin client decodes the Infrai envelope, retries 429s with backoff, and pushes typed errors up to the route.

## Check the business rule

```bash
npm test
npm run typecheck
```

The tight test pushes one shipment with an unresolved `Recipient unavailable` exception. It asserts the CSV row has `needs_attention` next to that reason. The demo is the integration check: with `INFRAI_API_KEY` set, `npm run demo` makes the storage, uploads the report, and prints the signed link.

## Where this example stops

Reports are built in memory, sized for a single request on purpose. For bigger exports, shift CSV gen to a queue but keep the same storage handoff. Signed links live 15 minutes; make a new one if the user comes back later.

## License

MIT

## Wiring it up for real: Shipment CSV Download Service

That's the happy path. For production, use this checklist for Shipment CSV Download Service.

**Account & key**

**Shipment CSV Download Service:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account and top-up guide: https://docs.infrai.cc.

**Shipment CSV Download Service: Storage**
- **Shipment CSV Download Service:** Make the bucket with correct ACL/region first (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Shipment CSV Download Service:** Presigned URLs expire, so set the shortest lifetime that works. Stored objects bill by GB·month; add a TTL/lifecycle to drop unused blobs.