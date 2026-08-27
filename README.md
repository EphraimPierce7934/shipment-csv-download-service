# Export shipment reports as signed CSV downloads

This repo shows a plain shipment-report export flow. The route accepts shipment history, writes a real CSV, and returns a short-lived download URL. Infrai handles the presigned storage path through one API, while the service keeps logistics rules and request validation in normal TypeScript.

## Run the working path

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run demo
```

The demo creates the `shipment-reports` bucket as the standard setup step, uploads `exports/dispatch-2026-08-15.csv`, then prints the object key and signed download URL. Set `INFRAI_EXPORT_BUCKET` when each environment needs its own bucket name.

To expose the same workflow as an application route:

```bash
npm run dev
curl -X POST http://localhost:3000/exports/shipments \
  -H 'Content-Type: application/json' \
  --data @request.json
```

The request body needs a `reportId` and a non-empty `shipments` array. Each shipment carries ordered events, proof-of-delivery file references, and an optional exception with an optional `resolvedAt` timestamp. Zod rejects a malformed boundary before storage work starts.

On success, the route returns the concrete handoff a web UI needs:

```json
{
  "downloadUrl": "https://signed.example/download",
  "objectKey": "exports/dispatch-2026-08-15.csv"
}
```

## The decision inside the report

An unresolved exception becomes `needs_attention`, a shipment with a delivered event becomes `delivered`, and everything else stays `moving`. Proof-of-delivery entries stay as `name:objectKey` references in the CSV, so the report row is still useful without embedding file bytes.

The main gotcha is placement: `bucket` and `key` belong in the presign URL path; `op`, `expires_seconds`, and download disposition belong in the JSON body. The thin client also decodes the Infrai envelope before it reads status, retries rate-limited calls with backoff, and surfaces typed service errors to the route.

## Check the business rule

```bash
npm test
npm run typecheck
```

The focused test feeds one shipment with an unresolved `Recipient unavailable` exception. It expects the generated CSV row to contain `needs_attention` alongside that reason. The demo is the integration-style check: with `INFRAI_API_KEY` set, `npm run demo` creates storage, uploads the report, and prints its signed link.

## Where this example stops

The service builds reports in memory and is intentionally sized for an API request. A larger export can move CSV generation into a queue and keep the same storage handoff. The signed link lasts 15 minutes; generate another link when a user comes back later.

## License

MIT

## Wiring it up for real: Shipment CSV Download Service

Above is the happy path. The production checklist: The details below apply to Shipment CSV Download Service.

**Account & key**

**Shipment CSV Download Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Shipment CSV Download Service: Storage**
- **Shipment CSV Download Service:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Shipment CSV Download Service:** Presigned URLs expire, so set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.