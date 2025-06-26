import { Fluent } from "./fluent";

export async function ensureInstance<X>(value: X | Fluent<X>): Promise<X> {
    if (value instanceof Fluent) {
        return await value.materialize();
    } else {
        return value;
    }
}
