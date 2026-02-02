declare module "*?worker" {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

declare module "*?worker&v=2" {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

declare const __APP_VERSION__: string;
