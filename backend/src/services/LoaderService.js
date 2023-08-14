export function LoaderService({ logger, registry }) {

  async function load(loader, params) {
    const instance = registry[loader];
    return instance.load(params);
  };

  return {
    load,
  }

}
