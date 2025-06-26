// @ts-ignore
import * as socks from "socksv5";
import { Client, ClientFluent } from "./client";
import * as net from 'net';
import { randomBytes } from 'crypto';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ensureInstance } from "./utils";
import { Fluent } from "./fluent";


function getRandomAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, () => {
            const address = server.address();
            if (typeof address === 'object' && address?.port) {
                const port = address.port;
                server.close(() => resolve(port));
            } else {
                reject(new Error("Failed to get port"));
            }
        });
        server.on('error', reject);
    });
}

function generateBase64Safe(len: number): string {
    return randomBytes(len).toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, len);
}


export type ProxyParams = {
    client?: Client,
    netInterface?: string,
    port?: number,
    auths?: Auth[]
};

export class Auth {
    static random(): Auth {
        return Auth.create();
    }

    static create(user?: string, pass?: string) {
        return new Auth(
            user || generateBase64Safe(12),
            pass || generateBase64Safe(24)
        );
    }

    constructor(public user: string, public pass: string) { }

    get userQueryParam() {
        return encodeURIComponent(this.user);
    }

    get passQueryParam() {
        return encodeURIComponent(this.pass);
    }
}

export class Proxy {
    server: any;

    static async create(params?: ProxyParams): Promise<Proxy> {
        params = params || {};

        return new Proxy(
            params.client || await Client.create(),
            params.netInterface || "localhost",
            params.port || await getRandomAvailablePort(),
            params.auths || []
        );
    }

    private constructor(private client: Client, public netInterface = "localhost", public port = 65050, public auths: Array<Auth> = []) {
        // @ts-ignore
        this.server = socks.createServer(async (info, accept, _deny) => {
            let socket;
            if (socket = accept(true))
                this.handleSocket(client, socket, info.dstAddr, info.dstPort);
        });
        this.server.listen(port, netInterface, () => { });
        // @ts-ignore
        this.server.useAuth(socks.auth.UserPassword(function (user, pass, callback) {
            for (const auth of auths) {
                if (auth.user === user && auth.pass === pass) {
                    callback(true);
                    return;
                }
            }
            callback(false);
        }));
    }

    async close() {
        this.server.close();
    }

    private async handleSocket(client: Client, socket: any, hostname: string, port: number) {
        const messages: Array<any> = [];

        const listener = async (data: any) =>
            messages.push(data);

        socket.on("data", listener);

        const stream = await client.connect(hostname, port);

        for (const message of messages)
            stream.write(message);

        stream.off("data", listener);
        stream.pipe(socket);
        socket.pipe(stream);

        const destroyBoth = (err?: any) => {
            setTimeout(() => {
                socket.destroy(err);
                stream.destroy(err);
            }, 100);
        };

        // Error handling
        stream.once("error", destroyBoth);
        socket.once("error", destroyBoth);

        // Close handling
        stream.once("close", () => socket.destroy());
        socket.once("close", () => stream.destroy());

        // End
        stream.once("end", () => destroyBoth());
        socket.once("end", () => destroyBoth());
    }
}

export class ProxyAgent extends SocksProxyAgent {
    constructor(public hostname: string, public port: number, public auth?: Auth) {
        const proxyUrl = auth
            ? `socks://${auth.userQueryParam}:${auth.passQueryParam}@${hostname}:${port}`
            : `socks://${hostname}:${port}`;
        super(proxyUrl);
    }
}












export class ProxyFluent extends Fluent<Proxy> {

    private proxyAgentConf: ProxyConf | null | ProxyConfFluent = null;

    static withClientBuilder(proxyAgentCond: ProxyConf | ProxyConfFluent): ProxyFluent {
        const instance = new ProxyFluent();
        instance.proxyAgentConf = proxyAgentCond;
        return instance;
    }

    protected async make(): Promise<Proxy> {
        let proxyAgentConf = await ensureInstance(this.proxyAgentConf!);
        return await Proxy.create(proxyAgentConf as ProxyParams);
    }
}


export type ProxyConf = {
    client?: Client | ClientFluent,
    netInterface?: string,
    port?: number,
    auths: Auth[]
};

export class ProxyConfFluent extends Fluent<ProxyConf> {
    protected async make(): Promise<ProxyConf> {
        return { auths: [] };
    }

    /**
     * Adds a custom Client to the configuration.
     */
    client(client: Client | ClientFluent): this {
        return this.push(conf => {
            conf.client = client;
        });
    }

    /**
     * Adds a custom netInterface to the configuration.
     */
    netInterface(netInterface: string): this {
        return this.push(conf => {
            conf.netInterface = netInterface;
        });
    }

    /**
     * Adds a custom port to the configuration.
     */
    port(port: number): this {
        return this.push(conf => {
            conf.port = port;
        });
    }

    /**
     * Adds a custom Auths to the configuration. This will entirely replace any previously defined Auths.
     */
    auths(auths: Auth[]): this {
        return this.push(conf => {
            conf.auths = auths;
        });
    }

    /**
 * Adds a single Auth entry to the current auths pool.
     */
    addAuth(auth: Auth): this {
        return this.push(conf => {
            conf.auths.push(auth);
        });
    }

    /**
     * Build a ProxyFluent from this ProxyConfFluent.
     */
    toProxy(): ProxyFluent {
        return ProxyFluent.withClientBuilder(this);
    }
}
