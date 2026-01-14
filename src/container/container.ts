class Container {
    private registry = new Map<symbol, any>();

    register<T>(token: symbol, instance: T): void {
        this.registry.set(token, instance);
    }

    resolve<T>(token: symbol): T {
        const instance = this.registry.get(token);
        if (!instance) {
            throw new Error(`No instance found for token: ${token.toString()}`);
        }
        return instance;
    }
}

export const container = new Container();