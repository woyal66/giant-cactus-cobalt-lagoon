type Chain = ((...args: unknown[]) => Promise<unknown>) & {
  validator: () => Chain;
  middleware: () => Chain;
  handler: (fn: (...args: unknown[]) => unknown) => Chain;
  inputValidator: () => Chain;
};

function createServerFn(): Chain {
  const chain = (async () => null) as Chain;
  chain.validator = () => chain;
  chain.middleware = () => chain;
  chain.inputValidator = () => chain;
  chain.handler = () => chain;
  return chain;
}

export { createServerFn };

export function createMiddleware() {
  const chain = {
    client: () => chain,
    server: () => chain,
  };
  return chain;
}

export function getCookie() {
  return undefined;
}
