import test from 'ava';
import { fluent } from '../dist/index.js';
import * as http from 'http';
import axios from 'axios';
import fetch from 'node-fetch';


function asyncFlag(maxTime) {
    let solve, reject;
    const promise = new Promise((s, r) => {
        let timer = setTimeout(() => reject("Timeout"), maxTime);
        solve = () => {
            clearInterval(timer);
            s();
        };
        reject = r;
    });

    return {
        solve,
        reject,
        promise
    };
}


test.skip('Hidden service and axios', async t => {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Hello, world!\n");
        server.close();
    });

    server.listen(80);

    const hiddenService = await fluent
        .onionServiceConf()
        .nickname("hanna")
        .toHiddenServiceConf()
        .handler("*", server)
        .toHiddenService()
        .materialize();

    await hiddenService.waitRunning();

    console.log("Hidden Service address:", hiddenService.address);

    const agent = await fluent.agent().materialize();

    const axiosResult = await axios.get("http://" + hiddenService.address, {
        httpAgent: agent,
    });

    hiddenService.close();

    console.log(axiosResult);
    t.is(axiosResult.data.includes("Hello, world!"));
});


test('Agent fetch/axios', async t => {
    const agent = await fluent.agent().materialize();

    const axiosResult = await axios.get('http://httpbin.org/ip', {
        httpAgent: agent
    });
    const fetchResult = await fetch("http://httpbin.org/ip", { agent });

    const axiosIp = axiosResult.data.origin;
    const fetchIp = (await fetchResult.json()).origin;

    t.truthy(axiosIp);
    t.truthy(fetchIp);

    console.log(axiosIp, fetchIp);
});


test('Agent https fetch/axios', async t => {
    const agent = await fluent.agent().materialize();

    const axiosResult = await axios.get('https://httpbin.org/ip', {
        httpsAgent: agent
    });
    const fetchResult = await fetch("https://httpbin.org/ip", { agent });

    const axiosIp = axiosResult.data.origin;
    const fetchIp = (await fetchResult.json()).origin;

    t.truthy(axiosIp);
    t.truthy(fetchIp);

    console.log(axiosIp, fetchIp);
});


test.skip('Agent', async t => {
    const getIp = async (agent, n) => {
        for (let i = 0; i < n; i++) {
            const result = await new Promise(async (solve, reject) => {
                http.get({
                    host: 'httpbin.org',
                    path: '/ip',
                    port: 80,
                    agent,
                }, (res) => {
                    let data = '';

                    res.on('data', chunk => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        try {
                            const ipData = JSON.parse(data);
                            solve(ipData.origin);
                        } catch (err) {
                            reject(err);
                        }
                    });

                    res.on('error', err => {
                        reject(err);
                    });
                });
            }).catch(_ => null);
            if (result)
                return result;
        }
    };

    const ip = await getIp(null, 20);
    let torIp = await getIp(await fluent.agent().materialize(), 20) || ip;

    t.truthy(ip !== torIp);
});


test.skip('Basic client', async t => {
    const hostname = 'httpbin.org';
    const path = '/ip';
    const client = await fluent.client().materialize();
    const stream = await client.connect(hostname, 80);

    const request = Buffer.from(
        `GET ${path} HTTP/1.1\r\nHost: ${hostname}\r\nConnection: close\r\n\r\n`,
        'utf8'
    );

    stream.write(request);

    let response = Buffer.alloc(0);
    stream.on('data', chunk => {
        response = Buffer.concat([response, chunk]);
    });

    stream.on('end', () => {
        console.log(response.toString('utf8'));
    });
});


test.skip('Hidden service and handlers', async t => {
    const { solve: serverReceive, promise: serverPromise } = asyncFlag(60000);
    const { solve: clientReceive, promise: clientPromise } = asyncFlag(60000);

    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Hello, world!\n');
        serverReceive();
    });
    server.listen(80);

    const hiddenService = await fluent
        .onionServiceConf()
        .nickname("hanna-" + Math.floor(Math.random() * 10000))
        .toHiddenServiceConf()
        .callbacks({})
        .handler('*', server)
        .toHiddenService()
        .materialize();

    await hiddenService.waitRunning();
    console.log(hiddenService.address);

    const client = await fluent.client().materialize();
    let stream = await client.connect(hiddenService.address, 85);


    stream.on("data", clientReceive);

    const httpRequest =
        `GET / HTTP/1.1\r\n` +
        `Host: localhost\r\n` +
        `Connection: close\r\n` +
        `\r\n`;

    stream.write(httpRequest);

    await serverPromise;
    await clientPromise;

    hiddenService.close();
    server.close();

    t.truthy(serverReceive, 'server');
    t.truthy(clientReceive, 'client');
});
