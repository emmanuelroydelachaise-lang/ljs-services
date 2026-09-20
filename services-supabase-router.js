(() => {
  if (!window.supabase || window.__LJS_SERVICES_ROUTER__) return;
  window.__LJS_SERVICES_ROUTER__ = true;

  const originalCreateClient = window.supabase.createClient.bind(window.supabase);

  const mapDbName = (name) => {
    if (typeof name !== 'string') return name;
    return name.startsWith('ljs_') ? 'services_' + name.slice(4) : name;
  };

  const mapFunctionName = (name) => {
    if (name === 'manage-technician') return 'services-manage-technician';
    return name;
  };

  window.supabase.createClient = function(url, key, options) {
    const client = originalCreateClient(url, key, options);

    return new Proxy(client, {
      get(target, prop) {
        if (prop === 'from') {
          return (name) => target.from(mapDbName(name));
        }

        if (prop === 'rpc') {
          return (name, args, opts) => target.rpc(mapDbName(name), args, opts);
        }

        if (prop === 'functions') {
          const functions = target.functions;
          return new Proxy(functions, {
            get(fnTarget, fnProp) {
              if (fnProp === 'invoke') {
                return (name, invokeOptions) =>
                  fnTarget.invoke(mapFunctionName(name), invokeOptions);
              }
              const value = Reflect.get(fnTarget, fnProp, fnTarget);
              return typeof value === 'function' ? value.bind(fnTarget) : value;
            }
          });
        }

        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
  };
})();