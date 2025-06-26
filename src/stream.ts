import { TorStream } from "@pynk/pynk";
import { Duplex } from "stream";

export class Stream extends Duplex {
    static create(stream: TorStream) {
        return new Stream(stream);
    }

    private constructor(private stream: TorStream) {
        super({ objectMode: false });
    }

    _read(size: number): void {
        (async () => {
            try {
                const chunk = await this.stream.read(size);
                if (chunk && chunk.length > 0) {
                    this.push(chunk);
                } else {
                    this.push(null);
                }
            } catch (err) {
                this.push(null);
            }
        })();
    }

    _write(chunk: Buffer | string, encoding: string, callback: (error?: Error | null) => void): void {
        (async () => {
            try {
                const data = typeof chunk === 'string' ? Buffer.from(chunk, encoding as BufferEncoding) : chunk;
                await this.stream.write(data);
                await this.stream.flush();
                callback(null);
            } catch (err) {
                callback(err as Error);
            }
        })();
    }

    _final(callback: (error?: Error | null) => void): void {
        (async () => {
            try {
                await this.stream.close();
                callback(null);
            } catch (err) {
                callback(err as Error);
            }
        })();
    }

    _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
        (async () => {
            try {
                await this.stream.close();
                callback(null);
            } catch (err) {
                callback(err as Error);
            }
        })();
    }
}
