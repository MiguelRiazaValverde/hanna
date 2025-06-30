import { TorClientBuilder } from "@pynk/pynk";
import { ClientBuilderFluent, ClientConfigFluent } from "./builder";
import { ClientFluent, Client } from "./client";
import { OnionServiceConfFluent, HiddenServiceConfFluent, HiddenServiceConf, HiddenServiceFluent, OnionV3Fluent } from "./hidden_service";
import { Auth, ProxyAgent, Proxy, ProxyConfFluent } from "./proxy";
import { ensureInstance } from "./utils";
import { AgentConf, AgentConfFluent, AgentFluent } from "./agent";


export function clientBuilder(): ClientBuilderFluent {
    return new ClientBuilderFluent();
}

export function clientConfig(): ClientConfigFluent {
    return new ClientConfigFluent();
}

export function client(torClientBuilder?: TorClientBuilder | ClientBuilderFluent): ClientFluent {
    return ClientFluent.withClientBuilder(torClientBuilder!);
}



export function onionServiceConf(): OnionServiceConfFluent {
    return new OnionServiceConfFluent();
}

export function hiddenServiceConf(): HiddenServiceConfFluent {
    return new HiddenServiceConfFluent();
}

export function hiddenService(conf?: HiddenServiceConf | HiddenServiceConfFluent): HiddenServiceFluent {
    return HiddenServiceFluent.withConf(conf!);
}

export function onionV3(): OnionV3Fluent {
    return new OnionV3Fluent();
}




export function auth(user?: string, pass?: string): Auth {
    return Auth.create(user, pass);
}

export function proxyAgent(hostname: string, port: number, auth?: Auth): ProxyAgent {
    return new ProxyAgent(hostname, port, auth);
}

export async function proxy(client: Client | ClientFluent, netInterface?: string, port?: number, auths?: any[]): Promise<Proxy> {
    const intancedClient = await ensureInstance(client);
    return await Proxy.create({ client: intancedClient, netInterface, port, auths });
}

export function proxyConf(): ProxyConfFluent {
    return new ProxyConfFluent();
}






export function agentConf(): AgentConfFluent {
    return new AgentConfFluent();
}

export function agent(conf?: AgentConf | AgentConfFluent): AgentFluent {
    return AgentFluent.withAgentConf(conf);
}
