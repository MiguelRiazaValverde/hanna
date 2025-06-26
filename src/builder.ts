import {
    ConfigCircuitTiming,
    ConfigDirectoryTolerance,
    ConfigDownloadSchedule,
    ConfigNetParams,
    ConfigPathRules,
    ConfigPreemptiveCircuits,
    ConfigStorage,
    ConfigStreamTimeouts,
    PaddingLevel,
    TorClientBuilder,
    TorClientConfig
} from "@pynk/pynk";
import { ensureInstance } from "./utils";
import { Fluent } from "./fluent";
import { ClientFluent } from "./client";
import { clientBuilder } from "./fluent_api";



export class ClientConfigFluent extends Fluent<TorClientConfig> {

    protected make(): Promise<TorClientConfig> {
        return this.asPromise(TorClientConfig.create());
    }

    /**
     * Should we allow attempts to make Tor connections to local addresses? This option is off by default, since (by default) Tor exits will always reject connections to such addresses.
     */
    allowLocalAddrs(value: boolean): this {
        return this.push(config => {
            config.allowLocalAddrs(value);
        });
    }

    /**
     * Padding conf.
     */
    padding(level: PaddingLevel): this {
        return this.push(config => {
            config.padding(level);
        });
    }

    /**
     * Allows configuring the storage by providing a callback that receives the current storage instance.
     */
    withStorage(callback: (storage: ConfigStorage) => void): this {
        return this.push(config => {
            callback(config.storage);
        });
    }

    /**Allows configuring the circuit timing by providing a callback that receives the current circuit timing instance.
     * 
     */
    withCircuitTiming(callback: (storage: ConfigCircuitTiming) => void): this {
        return this.push(config => {
            callback(config.circuitTiming);
        });
    }

    /**
     * Allows configuring the directory tolerance by providing a callback that receives the current directory tolerance instance.
     */
    withDirectoryTolerance(callback: (storage: ConfigDirectoryTolerance) => void): this {
        return this.push(config => {
            callback(config.directoryTolerance);
        });
    }

    /**
     * Allows configuring the download schedule by providing a callback that receives the current download schedule instance.
     */
    withDownloadSchedule(callback: (storage: ConfigDownloadSchedule) => void): this {
        return this.push(config => {
            callback(config.downloadSchedule);
        });
    }

    /**
     * Allows configuring the net params by providing a callback that receives the current net params instance.
     */
    withNetParams(callback: (storage: ConfigNetParams) => void): this {
        return this.push(config => {
            callback(config.netParams);
        });
    }

    /**
     * Allows configuring the path rules by providing a callback that receives the current path rules instance.
     */
    withPathRules(callback: (storage: ConfigPathRules) => void): this {
        return this.push(config => {
            callback(config.pathRules);
        });
    }

    /**
     * Allows configuring the preemptive circuits by providing a callback that receives the current preemptive circuits instance.
     */
    witPreemptiveCircuits(callback: (storage: ConfigPreemptiveCircuits) => void): this {
        return this.push(config => {
            callback(config.preemptiveCircuits);
        });
    }

    /**
     * Allows configuring the stream timeouts by providing a callback that receives the current stream timeouts instance.
     */
    withStreamTimeouts(callback: (storage: ConfigStreamTimeouts) => void): this {
        return this.push(config => {
            callback(config.streamTimeouts);
        });
    }

    /**
     * Build a ClientBuilderFluent from this ClientConfigFluent.
     */
    toBuilder(): ClientBuilderFluent {
        return clientBuilder().config(this);
    }
}



export class ClientBuilderFluent extends Fluent<TorClientBuilder> {
    protected make(): Promise<TorClientBuilder> {
        return this.asPromise(TorClientBuilder.create());
    }

    /**
     * Set the configuration for the TorClient under construction. If not called, then a compiled-in default configuration will be used.
     */
    config(config: ClientConfigFluent | TorClientConfig): this {
        return this.push(async builder => {
            const instanced = await ensureInstance(config);
            builder.config(instanced);
        });
    }

    /**
     * Build a ClientFluent from this ClientBuilder.
     */
    toClient(): ClientFluent {
        return ClientFluent.withClientBuilder(this);
    }
}