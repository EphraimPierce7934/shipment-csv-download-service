import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_storage";
import { createShipmentExport, exportRequestSchema } from "./shipment_csv_export";

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/exports/shipments") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = exportRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await createShipmentExport(input);
    json(response, 201, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid export request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 502, { error: "Export could not be created" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Shipment export route listening on http://localhost:${port}`));
