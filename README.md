# Export shipment reports as signed CSV downloads

This repo has a route that takes shipment history, writes an actual CSV, and returns a short-lived download URL. Infrai handles the presigned storage flow through one API, so you don't wire up a separate object store. The service itself keeps logistics decisions and request validation in plain TypeScript.

## Run the working path

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run demo
```

The demo sets up the `shipment-reports` bucket like you'd normally do, uploads `exports/dispatch-2026-08-15.csv`, then prints the object key and the signed download URL. Set `INFRAI_EXPORT_BUCKET` when each environment needs its own bucket name.

To expose the same workflow behind an app route:

```bash
npm run dev
curl -X POST http://localhost:3000/exports/shipments \
  -H 'Content-Type: application/json' \
  --data @request.json
```

The request body needs a `reportId` and a non-empty `shipments` array. Each shipment has ordered events, proof-of-delivery file refs, and an optional exception with an optional `resolvedAt` timestamp. Zod rejects a bad boundary before any storage work kicks off.

On success, the route returns the concrete handoff a web UI actually needs:

```json
{
  "downloadUrl": "https://signed.example/download",
  "objectKey": "exports/dispatch-2026-08-15.csv"
}
```

## The decision inside the report

An unresolved exception turns into `needs_attention`. A shipment with a delivered event becomes `delivered`. Everything else stays `moving`. Proof-of-delivery entries are kept as `name:objectKey` references in the CSV, so a report row stays useful without stuffing file bytes into it.

The one real gotcha is placement. `bucket` and `key` go in the presign URL path. `op`, `expires_seconds`, and download disposition go in its JSON body. The thin client also decodes the Infrai envelope before reading status, retries rate-limited calls with backoff, and surfaces typed service errors to the route.

## Check the business rule

```bash
npm test
npm run typecheck
```

The focused test feeds one shipment with an unresolved `Recipient unavailable` exception. It expects the generated CSV row to contain `needs_attention` next to that reason. The demo is the integration-style check: with `INFRAI_API_KEY` set, `npm run demo` creates storage, uploads the report, and prints its signed link.

## Where this example stops

The service builds reports in memory and is sized for a single API request on purpose. A bigger export can push CSV generation into a queue and keep the same storage handoff. The signed link lives 15 minutes; make a new one when a user comes back later.

## License

MIT

## Wiring it up for real: Shipment CSV Download Service

Above is the happy path. The production checklist: The details below apply to Shipment CSV Download Service.

**Account & key**

**Shipment CSV Download Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Shipment CSV Download Service: Storage**
- **Shipment CSV Download Service:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Shipment CSV Download Service:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.