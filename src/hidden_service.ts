import { OnionService, OnionServiceConfig, OnionV3, RendRequest, StreamRequest, StreamsRequest } from "@pynk/pynk";
import { Client, ClientFluent } from "./client";
import { ensureInstance } from "./utils";
import { Fluent } from "./fluent";
import { Stream } from "./stream";
import * as http from 'http';


export class HiddenServiceCallbacks {
    onRendRequest(request: RendRequest, hiddenService: HiddenService): boolean { return true; }
    onStreamRequest(request: StreamRequest, hiddenService: HiddenService): boolean { return true; }
    onStream(stream: Stream, hiddenService: HiddenService) { }
}


export class HiddenServiceHandler {
    private matchPort: (port: number) => boolean;
    public locality: number = 0;

    constructor(private portRange: string, private handler: http.Server | string | number | ((stream: Stream) => void)) {
        if (!portRange.match(/^(\*|\d+|\d+-\d+)$/))
            throw new Error("Invalid port range");

        const split = portRange.split('-');

        if (split.length > 1) {
            const a = parseInt(split[0]);
            const b = parseInt(split[1]);
            const min = Math.min(a, b);
            const max = Math.min(a, b);
            this.matchPort = (port) => port >= min && port <= max;
            this.locality = max - min + 1;
        } else if (split[0] === '*') {
            this.matchPort = (_) => true;
        } else {
            const value = parseInt(split[0]);
            this.matchPort = (port) => port === value;
            this.locality = 1;
        }
    }

    match(port: number): boolean {
        return this.matchPort(port);
    }

    handle(stream: Stream) {
        if (this.handler instanceof http.Server)
            this.handler.emit("connection", stream);
        else if (this.handler instanceof Function)
            this.handler(stream);
    }
}

export class HiddenService {


    private constructor(
        public client: Client,
        public hiddenService: OnionService,
        public callbacks: HiddenServiceCallbacks,
        private handlers: Array<HiddenServiceHandler> = []) {
        this.startPoll();
    }

    static async create(
        client?: Client,
        onionServiceConfig?: OnionServiceConfig,
        callbacks?: HiddenServiceCallbacks,
        handlers: Array<HiddenServiceHandler> = []
    ) {
        client = client || await Client.create();
        const onionService = client.client.createOnionService(onionServiceConfig || new OnionServiceConfig());
        return new HiddenService(client, onionService, callbacks || new HiddenServiceCallbacks(), handlers);
    }

    private async startPoll() {
        let rendRequest: RendRequest | null;
        while (rendRequest = await this.hiddenService.poll().catch(() => null)) {
            if (this.callbacks.onRendRequest(rendRequest, this)) {
                const streamsRequest = await rendRequest.accept();
                streamsRequest && this.startStreamsPoll(streamsRequest);
            } else {
                rendRequest.reject();
            }
        }
    }

    private async startStreamsPoll(streamsRequest: StreamsRequest) {
        let streamRequest: StreamRequest | null;
        while (streamRequest = await streamsRequest.poll()) {
            if (this.callbacks.onStreamRequest(streamRequest, this)) {
                const port = streamRequest.port() || 0;
                const torStream = await streamRequest.accept();
                if (!torStream)
                    continue;
                const stream = Stream.create(torStream);
                this.callbacks.onStream(stream, this);

                let bestHandler: HiddenServiceHandler | null = null;
                for (const handler of this.handlers) {
                    if (!bestHandler && handler.match(port))
                        bestHandler = handler;
                    else if (bestHandler && handler.match(port) && handler.locality > bestHandler.locality) {
                        bestHandler = handler;
                    }
                }

                if (bestHandler) {
                    bestHandler.handle(stream);
                }
            }

        }
    }

    async waitRunning(maxTime?: number): Promise<this> {
        await this.hiddenService.waitRunning(maxTime);
        return this;
    }

    get address() {
        return this.hiddenService.address();
    }

    async close(): Promise<this> {
        this.hiddenService.close();
        return this;
    }

    addHandler(portRange: string, handler: http.Server | string | number | ((stream: Stream) => void)): this {
        this.handlers.push(new HiddenServiceHandler(portRange, handler));
        return this;
    }
}


export class HiddenServiceFluent extends Fluent<HiddenService> {
    private conf: HiddenServiceConf | null | HiddenServiceConfFluent = null;

    static withConf(conf: HiddenServiceConf | HiddenServiceConfFluent): HiddenServiceFluent {
        const instance = new HiddenServiceFluent();
        instance.conf = conf;
        return instance;
    }

    protected async make(): Promise<HiddenService> {
        const conf = await ensureInstance(this.conf || { handlers: [] });
        const client = await ensureInstance(conf.client!);
        const onionConf = await ensureInstance(conf.onionConf!);
        return await HiddenService.create(client, onionConf, conf.callbacks, conf.handlers);
    }
}


export type HiddenServiceConf = {
    client?: Client | ClientFluent,
    onionConf?: OnionServiceConfig | OnionServiceConfFluent,
    callbacks?: HiddenServiceCallbacks,
    handlers: Array<HiddenServiceHandler>,
};

export class HiddenServiceConfFluent extends Fluent<HiddenServiceConf> {
    protected async make(): Promise<HiddenServiceConf> {
        return { handlers: [] };
    }

    /**
     * Adds a custom Client to the configuration.
     */
    client(client: Client | ClientFluent): this {
        return this.push(config => {
            config.client = client;
        });
    }

    /**
     * Adds a custom OnionServiceConfig to the configuration.
     */
    onionConf(onionConf: OnionServiceConfig | OnionServiceConfFluent): this {
        return this.push(config => {
            config.onionConf = onionConf;
        });
    }

    /**
     * Adds custom HiddenServiceCallbacks to the configuration.
     * 
     * @example
     * ```ts
     * new HiddenServiceConfFluent().callbacks(new class _ extends HiddenServiceCallbacks {
            onStream(stream: Stream): void {
                stream.on("data", console.log);
                stream.write("Hola");
            }
        })
     * ```
     */
    callbacks(callbacks: HiddenServiceCallbacks): this {
        return this.push(config => {
            config.callbacks = callbacks;
        });
    }

    /**
     * Build a HiddenServiceFluent from this HiddenServiceConfFluent.
     */
    toHiddenService(): HiddenServiceFluent {
        return HiddenServiceFluent.withConf(this);
    }

    /**
     * Adds a handler to the hidden service.
     */
    handler(portRange: string, handler: http.Server | string | number | ((stream: Stream) => void)): this {
        return this.push(conf => {
            conf.handlers.push(new HiddenServiceHandler(portRange, handler));
        });
    }
}

export class OnionServiceConfFluent extends Fluent<OnionServiceConfig> {
    protected async make(): Promise<OnionServiceConfig> {
        return new OnionServiceConfig();
    }

    /**
     * The nickname used to look up this service's keys, state, configuration, etc.
     * __Required__.
     */
    nickname(nickname: string): this {
        return this.push(config => {
            config.nickname(nickname);
        });
    }

    /**
     * Build a HiddenServiceConfFluent from this OnionServiceConfFluent.
     */
    toHiddenServiceConf(): HiddenServiceConfFluent {
        return new HiddenServiceConfFluent().onionConf(this);
    }
}


export class OnionV3Fluent extends Fluent<OnionV3> {
    protected async make(): Promise<OnionV3> {
        return new OnionV3();
    }

    /**
     * Creates an Onion v3 instance from a 32-byte secret key buffer.
     */
    fromSecret(secret: Buffer): this {
        return this.push(_ => {
            return OnionV3.fromSecret(secret);
        });
    }

    /**
     * Generates a vanity Onion v3 address with the specified prefix. Yields execution every stopEach attempts to avoid blocking the async runtime.
     */
    vanity(prefix: string, stopEach = 1000): this {
        return this.push(async _ => {
            return await OnionV3.generateVanityAsync(prefix);
        });
    }
}