import test from 'ava';
import { fluent, HiddenServiceCallbacks } from '../dist/index.js';
import * as http from 'http';

test('Agent', async t => {

    const getIp = async agent => {
        return await new Promise(async (solve, reject) => {
            http.get({
                host: 'httpbin.org',
                path: '/ip',
                port: 80,
                agent,
            }, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    solve(JSON.parse(data).origin);
                });

                res.on('error', (err) => {
                    reject(err);
                });
            });
        });

    };

    const ip = await getIp();
    const torIp = await getIp(await fluent.agent().materialize());

    console.log(ip, torIp);

    t.truthy(ip !== torIp);
});

test('_', async t => {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Hello, world!\n');
        hiddenService.close();
        server.close();
    });

    const hiddenService = await fluent
        .onionServiceConf()
        .nickname("eo")
        .toHiddenServiceConf()
        .callbacks(new class _ extends HiddenServiceCallbacks {
            onStreamRequest(request, hiddenService) {
                return true;
            }
        })
        .handler('*', server)
        .toHiddenService()
        .materialize();

    await hiddenService.waitRunning();

    const client = await fluent.client().materialize();
    let stream = await client.connect(hiddenService.address, 85);

    // stream.on("data", data => console.log(data.toString('utf8')));
    stream.on("end", () => console.log("end"));

    const httpRequest =
        `GET / HTTP/1.1\r\n` +
        `Host: localhost\r\n` +
        `Connection: close\r\n` +
        `\r\n`;

    stream.write(httpRequest, () => {
        console.log('HTTP request sent to ' + hiddenService.address);
    });

    t.is(1, 1);
});

// (async () => {
//     const server = http.createServer((req, res) => {
//         console.log(`${req.method} ${req.url}`);
//         res.writeHead(200, { 'Content-Type': 'text/plain' });
//         res.end('Hello, world!\n');
//     });


//     const hiddenService = await fluent_api
//         .onionServiceConf()
//         .nickname("eo")
//         .toHiddenServiceConf()
//         .callbacks(new class _ extends HiddenServiceCallbacks {
//             onStreamRequest(request: StreamRequest, hiddenService: HiddenService): boolean {
//                 console.log(request.port());
//                 return true;
//             }
//         })
//         .handler('*', server)
//         .handler('85', stream => console.log('stream'))
//         .toHiddenService()
//         .materialize();

//     await hiddenService.waitRunning();

//     const client = await fluent_api.client().materialize();
//     let stream = await client.connect(hiddenService.address, 85);

//     stream.on("data", data => console.log(data.toString('utf8')));
//     stream.on("end", () => console.log("end"));

//     const httpRequest =
//         `GET / HTTP/1.1\r\n` +
//         `Host: localhost\r\n` +
//         `Connection: close\r\n` +
//         `\r\n`;

//     stream.write(httpRequest, () => {
//         console.log('HTTP request sent to ' + hiddenService.address);
//     });
// })();


// (async () => {
//     const auth = Auth.create("asdf", "tarta");
//     const server = await Proxy.create({
//         client: await Client.create(),
//         auths: [auth]
//     });

//     const agent = new ProxyAgent(
//         server.netInterface,
//         server.port,
//         auth
//     );

//     http.get('http://ipinfo.io', { agent }, async res => {
//         console.log(res.headers);
//         res.pipe(process.stdout);
//     }).on("error", err => { console.log("error") });
// })();

// (async () => {

//     const hostname = "httpbin.org";
//     const path = "/ip";

//     const client = await HannaClient.create();
//     const stream = await client.connect(hostname, 80);

//     stream.write(`GET ${path} HTTP/1.1\r\nHost: ${hostname}\r\nConnection: close\r\n\r\n`, (err) => {
//         console.log(err);
//     });

//     stream.on('data', (chunk) => {
//         console.log('Data:', chunk.toString("utf8"));
//     });

//     stream.on('end', () => {
//         console.log('End');
//     });
// })();
