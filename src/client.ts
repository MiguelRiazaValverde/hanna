import { TorClient, TorClientBuilder } from "@pynk/pynk";
import { Stream } from "./stream";
import { ensureInstance } from "./utils";
import { ClientBuilderFluent } from "./builder";
import { Fluent } from "./fluent";


export class Client {
    static async create(builder?: TorClientBuilder): Promise<Client> {
        let client = null;
        if (builder)
            client = await TorClient.create(builder);
        else
            client = await TorClient.create();
        return new Client(client);
    }

    constructor(public client: TorClient) { }

    /**
     * Launch an anonymized connection to the provided address and port over the Tor network.
     *
     * @example
     * ```ts
     * const client = await TorClient.create();
     * const stream = await client.connect("httpbin.org:80");
     *
     * // It is recommended to wait for the connection to be fully established
     * // by calling `waitForConnection()` after `connect()`.
     * await stream.waitForConnection();
     * ```
     */
    async connect(url: String, port: number, waitForConnection = true) {
        const conn = await this.client.connect(`${url}:${port}`);
        if (waitForConnection) await conn.waitForConnection();
        return Stream.create(conn);
    }

    /**
     * Return a new isolated TorClient handle.
     * The two TorClients will share internal state and configuration, but their streams will never share circuits with one another.
     * Use this function when you want separate parts of your program to each have a TorClient handle, but where you don't want their activities to be linkable to one another over the Tor network.
     * Calling this function is usually preferable to creating a completely separate TorClient instance, since it can share its internals with the existing TorClient.
     * Connections made with clones of the returned TorClient may share circuits with each other.)
     */
    isolated(): Client {
        return new Client(this.client.isolated());
    }
}


export class ClientFluent extends Fluent<Client> {

    private torClientBuilder: TorClientBuilder | null | ClientBuilderFluent = null;

    static withClientBuilder(torClientBuilder: TorClientBuilder | ClientBuilderFluent): ClientFluent {
        const instance = new ClientFluent();
        instance.torClientBuilder = torClientBuilder;
        return instance;
    }

    protected async make(): Promise<Client> {
        let torClientBuilder = await ensureInstance(this.torClientBuilder!);
        return Client.create(torClientBuilder);
    }
}

