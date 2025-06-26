import { Socket as SocketNet, SocketConnectOpts } from "net";
import { Client } from "./client";
import { Stream } from "./stream";

// export class Socket extends SocketNet {
//     private solveStream: (stream: Stream) => void;
//     private rejectStream: (any) => void;
//     private stream: Promise<Stream>;

//     static create(stream: Client): Socket {
//         return new Socket(stream);
//     }

//     private constructor(private client: Client) {
//         super({ readable: true, writable: true });

//         this.stream = new Promise((solve, reject) => {
//             this.solveStream = solve;
//             this.rejectStream = reject;
//         });

//         // Configurar eventos básicos del socket
//         this.on('close', () => this.handleClose());
//         this.on('error', (err) => this.handleError(err));
//     }

//     private async startReading(): Promise<void> {
//         const stream = await this.stream;
//         try {
//             while (this.readable) {
//                 const chunk = await stream.read(4096);
//                 if (chunk === null || chunk.length === 0) {
//                     this.end();
//                     break;
//                 }

//                 if (!this.push(chunk)) {
//                     await new Promise(resolve => this.once('drain', resolve));
//                 }
//             }
//         } catch (err) {
//             this.end();
//         }
//     }

//     connect(...args: any[]): this {
//         // Implementación polimórfica para manejar todas las sobrecargas de connect()
//         const normalized = this.normalizeConnectArgs(args);
//         const options = normalized[0] as any;
//         const callback = normalized[1] as (() => void) | undefined;

//         process.nextTick(async () => {
//             try {
//                 const stream = await this.client.connect(options.host! as string, options.port! as number);
//                 this.solveStream(stream);

//                 this.emit('connect');
//                 this.startReading();

//                 if (callback) {
//                     callback();
//                 }
//             } catch (err) {
//                 this.rejectStream(err);
//                 this.emit('error', err);
//             }
//         });

//         return this;
//     }

//     _write(chunk: Buffer | string, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
//         (async () => {
//             const stream = await this.stream;
//             try {
//                 const data = typeof chunk === 'string' ? Buffer.from(chunk, encoding) : chunk;
//                 await stream.write(data);
//                 callback(null);
//             } catch (err) {
//                 callback(err as Error);
//             }
//         })();
//     }

//     _final(callback: (error?: Error | null) => void): void {
//         (async () => {
//             const stream = await this.stream;
//             try {
//                 await stream.destroy();
//                 callback(null);
//             } catch (err) {
//                 callback(err as Error);
//             }
//         })();
//     }

//     private handleClose(): void {
//         (async () => {
//             const stream = await this.stream;
//             try {
//                 await stream.destroy();
//             } catch (err) {
//                 this.emit('error', err);
//             }
//         })();
//     }

//     private handleError(err: Error): void {
//         // Puedes agregar lógica adicional de manejo de errores aquí
//         console.error('Socket error:', err);
//     }

//     // Opcional: Sobrescribir destroy para limpieza
//     destroy(error?: Error): this {
//         (async () => {
//             const stream = await this.stream;
//             try {
//                 await stream.destroy();
//             } catch (err) {
//                 console.error('Error during destruction:', err);
//             } finally {
//                 super.destroy(error);
//             }
//         })();

//         return this;
//     }

//     // Método auxiliar para manejar los diferentes formatos de connect()
//     private normalizeConnectArgs(args: any[]): [SocketConnectOpts, (() => void)?] {
//         // Implementación similar a la de net.Socket
//         let options: any = { port: 0, path: '' };
//         let callback: (() => void) | undefined;

//         if (typeof args[0] === 'object') {
//             options = { ...args[0] };
//             callback = args[1];
//         } else if (typeof args[0] === 'string' && args[0].indexOf('/') !== -1) {
//             options.path = args[0];
//             callback = args[1];
//         } else {
//             options.port = args[0];
//             if (typeof args[1] === 'string') {
//                 options.host = args[1];
//                 callback = args[2];
//             } else {
//                 callback = args[1];
//             }
//         }

//         return [options, callback];
//     }
// }