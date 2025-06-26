import * as http from 'http';
import * as stream from 'stream';
import { Client, ClientFluent } from '.';
import { Fluent } from './fluent';
import { ensureInstance } from './utils';


const hostnameRe = /^(?:https?:\/\/)?([^\/:?#]+)(?:[\/:?#]|$)/i;

export class Agent extends http.Agent {
    constructor(public client: Client, opts?: http.AgentOptions) {
        super(opts);
    }

    static async create(client?: Client, opts?: http.AgentOptions) {
        const clientInstance = client || await Client.create();
        return new Agent(clientInstance, opts);
    }

    createConnection(options: http.ClientRequestArgs, onCreate: (err: Error | null, socket: stream.Duplex) => void) {
        (async () => {
            const match = (options.host || options.hostname || "").match(hostnameRe);
            const hostname = match ? match[1] : "";
            try {
                const stream = await this.client.connect(hostname, parseInt(options.port?.toString() || '0'));
                onCreate(null, stream);
            } catch (err) {
                onCreate(err instanceof Error ? err : new Error(String(err)), null!);
            }
        })();
        return null;
    }
}

export class AgentFluent extends Fluent<Agent> {

    private conf: AgentConf | AgentConfFluent | null = null;

    static withAgentConf(conf?: AgentConf | AgentConfFluent): AgentFluent {
        const instance = new AgentFluent();
        instance.conf = conf || null;
        return instance;
    }

    protected async make(): Promise<Agent> {
        const conf = await ensureInstance(this.conf || {});
        let client = await ensureInstance(conf.client!);
        return await Agent.create(client, conf.opts);
    }
}

export type AgentConf = {
    client?: Client | ClientFluent,
    opts?: http.AgentOptions,
};

export class AgentConfFluent extends Fluent<AgentConf> {
    protected async make(): Promise<AgentConf> {
        return {};
    }

    client(client: Client | ClientFluent): this {
        return this.push(conf => {
            conf.client = client;
        });
    }

    opts(opts: http.AgentOptions): this {
        return this.push(conf => {
            conf.opts = opts;
        });
    }

    withOpts(callback: (opts: http.AgentOptions) => void): this {
        return this.push(conf => {
            conf.opts = conf.opts || {};
            callback(conf.opts);
        });
    }

    toAgent(): AgentFluent {
        return AgentFluent.withAgentConf(this);
    }
}
