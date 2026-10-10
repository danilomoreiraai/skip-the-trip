import { createServer } from "node:http";

const deliveries = [];
const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200).end("ok");
    return;
  }
  if (request.method === "GET" && request.url === "/deliveries") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(deliveries));
    return;
  }
  if (request.method !== "POST" || request.url !== "/alerts") {
    response.writeHead(404).end();
    return;
  }

  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    try {
      deliveries.push(JSON.parse(body));
      response.writeHead(200).end("acknowledged");
    } catch {
      response.writeHead(400).end("invalid JSON");
    }
  });
});

server.listen(9095, "0.0.0.0", () => console.log("Test alert receiver listening on 9095"));
