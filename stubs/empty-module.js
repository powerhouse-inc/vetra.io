// Inert stub for Node-only packages that the @powerhousedao/reactor-browser
// barrel transitively drags into the browser bundle (notably `pg`, which
// require()s `dns`/`fs`/`net`/`tls`). This app only uses the *browser* reactor
// and never the pg-backed server reactor, so the real package is never invoked
// at runtime — on the client or the server. Aliased in next.config.ts.
//
// A Proxy keeps every access inert: property reads return the stub, calls and
// `new` return empty values. So `import pg from 'pg'`, `import { Pool } from
// 'pg'`, and `new Pool()` all resolve without touching Node built-ins.
const stub = new Proxy(function stub() {}, {
  get: () => stub,
  apply: () => undefined,
  construct: () => ({}),
})

module.exports = stub
