# Hanna

[![Tag](https://img.shields.io/github/v/tag/MiguelRiazaValverde/hanna?label=version)](https://github.com/MiguelRiazaValverde/hanna/tags)
[![npm](https://img.shields.io/npm/v/@pynk/hanna?color=crimson&logo=npm)](https://www.npmjs.com/package/@pynk/hanna)

> **Hanna** is an ergonomic upper-level Node.js package built on top of [**Pynk**](https://www.npmjs.com/package/@pynk/pynk), designed to simplify and make painless working with Tor network connections.
> It abstracts away low-level details and provides easy-to-use, fluent APIs to launch, manage, and interact with Tor circuits and hidden services — all without needing a local Tor installation.

## Why Hanna?

While **Pynk** offers minimalistic low-level control over the Tor network, **Hanna** enhances developer experience by exposing a more user-friendly API, making Tor integration seamless in your Node.js projects.

## Features

- Simplified and fluent API to start and control Tor clients and circuits.
- Easy management of hidden services and streams.
- Zero dependency on local Tor binaries or installations.

## Installation

```bash
npm install @pynk/hanna
```

## Drop-in HTTP anonymity

Use **Hanna** to get a ready-to-use http.Agent for anonymous requests through the Tor network.

```js
import axios from "axios";
import { fluent } from "@pynk/hanna";

(async () => {
  const agent = await fluent.agent().materialize();

  const axiosResult = await axios.get("http://httpbin.org/ip", {
    httpAgent: agent,
  });

  console.log(axiosResult.data.origin);
})();
```

## Basic usage

This example demonstrates how to use the fluent API to connect to a host over the Tor network and make a simple HTTP request.

```js
import { fluent } from "@pynk/hanna";

(async () => {
  // Define the hostname and path you want to query
  const hostname = "httpbin.org";
  const path = "/ip";

  // Create and materialize a Tor client using the fluent API
  const client = await fluent.client().materialize();

  // Establish a connection (stream) to the specified host and port (HTTP port 80)
  const stream = await client.connect(hostname, 80);

  // Construct a raw HTTP GET request as a Buffer
  const request = Buffer.from(
    `GET ${path} HTTP/1.1\r\nHost: ${hostname}\r\nConnection: close\r\n\r\n`,
    "utf8"
  );

  // Send the request through the Tor stream
  stream.write(request);

  // Buffer to accumulate the response data
  let response = Buffer.alloc(0);

  // Listen for data chunks coming through the stream and concatenate them
  stream.on("data", (chunk) => {
    response = Buffer.concat([response, chunk]);
  });

  // When the stream ends, print the complete response as a UTF-8 string
  stream.on("end", () => {
    console.log(response.toString("utf8"));
  });
})();
```

## Example: Hosting and accessing a Tor Onion service

This example demonstrates how to easily create a simple HTTP server and expose it as a Tor onion service using Hanna. It shows how to:

- Configure and launch an anonymous hidden service with a unique nickname.
- Handle incoming requests on the onion service with a local HTTP server.
- Connect to the onion service as a Tor client and perform a basic HTTP request using `axios` over the Tor network.

```js
import { fluent } from "@pynk/hanna";
import * as http from "http";
import axios from "axios";

(async () => {
  // Create a simple HTTP server that responds with "Hello, world!"
  // The server will close automatically after handling the first request
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hello, world!\n");
    server.close();
  });

  // Listen on port 80 locally
  server.listen(80);

  // Configure a Tor onion service with a random nickname
  // The server handles all incoming requests ("*")
  const hiddenService = await fluent
    .onionServiceConf()
    .nickname("hanna") // required
    .toHiddenServiceConf()
    .handler("*", server) // set the HTTP server as the request handler
    .toHiddenService()
    .materialize();

  // Wait until the onion service is fully up and running
  await hiddenService.waitRunning();

  // Log the generated onion address for access via Tor
  console.log("Hidden Service address:", hiddenService.address);

  // Create a Tor-aware HTTP agent that can be used by axios
  const agent = await fluent.agent().materialize();

  // Use axios to make a request to the onion service via the Tor agent
  const axiosResult = await axios.get("http://" + hiddenService.address, {
    httpAgent: agent, // This routes the request through Tor
  });

  hiddenService.close(); // Clean up by shutting down the onion service

  console.log(axiosResult); // Output the full axios response
})();
```
