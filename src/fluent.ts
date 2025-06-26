


export type FluentAction<T> = (value: T) => T | void | Promise<T | void>;

export abstract class Fluent<T> {

    constructor(protected actions: Array<FluentAction<T>> = [], protected forced: T | null = null) { }

    protected abstract make(): Promise<T>;

    private instance(): Promise<T> {
        return this.forced ? this.asPromise(this.forced) : this.make();
    }

    protected push(action: FluentAction<T>): this {
        const Ctor = this.constructor as new (
            actions: Array<FluentAction<T>>,
            forced: T | null
        ) => this;
        return new Ctor([...this.actions, action], this.forced);
    }

    async materialize(): Promise<T> {
        let instance = await this.instance();
        for (const action of this.actions) {
            instance = await action(instance) || instance;
        }
        return instance;
    }

    protected async asPromise<T>(value: T) {
        return value;
    }
}



