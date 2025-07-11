import { OnionService, OnionServiceConfig, OnionV3, RendRequest, StateOnionService, StreamRequest, StreamsRequest } from "@pynk/pynk";
import { Client, ClientFluent } from "./client";
import { ensureInstance } from "./utils";
import { Fluent } from "./fluent";
import { Stream } from "./stream";
import * as http from 'http';


export type PortRange = '*' | `${number}` | `${number}-${number}`;
export type HiddenServiceCallbacks = {
    onRendRequest?: (request: RendRequest, hiddenService: HiddenService) => boolean,
    onStreamRequest?: (request: StreamRequest, hiddenService: HiddenService) => boolean,
    onStream?: (stream: Stream, hiddenService: HiddenService) => void
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
        else if (this.handler instanceof Function) {
            this.handler(stream);
        }
    }
}

export class HiddenService {

    private constructor(
        public client: Client,
        public hiddenService: OnionService,
        public callbacks: HiddenServiceCallbacks,
        private handlers: Array<HiddenServiceHandler> = []
    ) {
        this.startPoll();
    }

    static async create(
        client?: Client,
        onionServiceConfig?: OnionServiceConfig,
        callbacks?: HiddenServiceCallbacks,
        onionV3?: OnionV3,
        handlers: Array<HiddenServiceHandler> = [],
    ) {
        client = client || await Client.create();
        onionServiceConfig = onionServiceConfig || new OnionServiceConfig();
        const onionService = onionV3
            ? client.client.createOnionServiceWithKey(onionServiceConfig, onionV3.getSecret())
            : client.client.createOnionService(onionServiceConfig);
        return new HiddenService(client, onionService, callbacks || {}, handlers);
    }

    private async startPoll() {
        let rendRequest: RendRequest | null;
        while (rendRequest = await this.hiddenService.poll().catch(() => null)) {
            if (this.callbacks.onRendRequest?.(rendRequest, this) ?? true) {
                const streamsRequest = await rendRequest.accept();
                streamsRequest && this.startStreamsPoll(streamsRequest);
            } else {
                rendRequest.reject();
            }
        }
    }

    private async startStreamsPoll(streamsRequest: StreamsRequest) {
        let streamRequest: StreamRequest | null;

        while (streamRequest = await streamsRequest.poll().catch(() => null)) {
            if (this.callbacks.onStreamRequest?.(streamRequest, this) ?? true) {
                const port = streamRequest.port() || 0;
                const torStream = await streamRequest.accept();
                if (!torStream)
                    continue;
                const stream = Stream.create(torStream);
                this.callbacks.onStream?.(stream, this);

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

    /**
     * Waits until the hidden service reaches the `Running` state. If `maxTime` is provided, throws an error if the timeout is exceeded.
     * If the service enters the `Broken` state, throws an error immediately.
     */
    async waitRunning(maxTime?: number): Promise<this> {
        await this.hiddenService.waitRunning(maxTime);
        return this;
    }

    /**
     * Onion address of this service. Clients must know the service's onion address in order to discover or connect to it. Returns `null|undefined` if the HsId of the service could not be found in any of the configured keystores.
     */
    get address(): string | null {
        return this.hiddenService.address();
    }

    /**
     * Returns the current status of the hidden service.
     */
    get state(): StateOnionService {
        return this.hiddenService.state();
    }

    /**
     * Close the hidden service.
     */
    close(): this {
        this.hiddenService.close();
        return this;
    }

    /**
     * 
     */
    addHandler(portRange: PortRange, handler: http.Server | string | number | ((stream: Stream) => void)): this {
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
        const onionV3 = await ensureInstance(conf.onionV3!);
        return await HiddenService.create(client, onionConf, conf.callbacks, onionV3, conf.handlers);
    }
}


export type HiddenServiceConf = {
    client?: Client | ClientFluent,
    onionConf?: OnionServiceConfig | OnionServiceConfFluent,
    callbacks?: HiddenServiceCallbacks,
    onionV3?: OnionV3 | OnionV3Fluent,
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
                stream.write("Hello");
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
    handler(portRange: PortRange, handler: http.Server | string | number | ((stream: Stream) => void)): this {
        return this.push(conf => {
            conf.handlers.push(new HiddenServiceHandler(portRange, handler));
        });
    }

    /**
     * Adds a onion v3 key pair to hidden service.
     */
    onionV3(onionV3: OnionV3 | OnionV3Fluent): this {
        return this.push(conf => {
            conf.onionV3 = onionV3;
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