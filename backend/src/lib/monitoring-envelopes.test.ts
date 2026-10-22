import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

// Fresh processes isolate SDK globals/instrumentation. Transports only collect
// envelopes in memory; the HTTP case calls a loopback server, never Sentry.
function run(script: string) {
  return JSON.parse(
    execFileSync(process.execPath, ["-e", script], {
      encoding: "utf8",
      env: { ...process.env, SENTRY_TRACES_SAMPLE_RATE: "1", SENTRY_DSN: "", VERCEL: "" },
      timeout: 20000,
    }),
  );
}
const common = `
  const assert = require('node:assert/strict');
  const {errorOnlyMonitoringOptions,scrubMonitoringEvent} = require('@zelvomart/monitoring');
  const envelopes = [];
  const base = {
    dsn:'https://abc123@example.invalid/1', release:'a'.repeat(40),
    dataCollection:{userInfo:false,cookies:false,httpHeaders:false,httpBodies:[],urlQueryParams:false,frameContextLines:0},
    transport:()=>({send:async envelope=>{envelopes.push(envelope);return {};},flush:async()=>true}),
    beforeSend:scrubMonitoringEvent,beforeSendLog:()=>null,beforeSendMetric:()=>null,
  };
`;
test("browser sends sanitized errors without automatic sessions or client reports", () => {
  const result = run(`
    const listeners = {};
    global.document = {visibilityState:'visible',addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn);},removeEventListener:()=>{}};
    global.addEventListener = ()=>{};
    global.requestIdleCallback = fn=>setImmediate(()=>fn({didTimeout:false,timeRemaining:()=>50}));
    global.cancelIdleCallback = clearImmediate;
    global.location = {href:'https://shop.invalid/checkout?email=private@example.invalid',protocol:'https:',host:'shop.invalid'};
    const Sentry = require('@sentry/browser');
    ${common}
    (async()=>{
      const client = Sentry.init({...base,...errorOnlyMonitoringOptions()});
      assert.equal(client.getIntegrationByName('BrowserSession'),undefined);
      await new Promise(resolve=>setImmediate(resolve));
      await client.flush();
      assert.equal(envelopes.length,0,'ordinary page load must not send a session');
      Sentry.captureException(new Error('private@example.invalid'));
      client.recordDroppedEvent('before_send','error');
      document.visibilityState='hidden';
      for(const fn of listeners.visibilitychange??[])fn();
      await client.flush();
      console.log(JSON.stringify(envelopes));
      await Sentry.close();
    })().catch(error=>{console.error(error);process.exitCode=1;});
  `);
  assert.equal(result.length, 1);
  assert.deepEqual(
    result.flatMap((envelope: any) => envelope[1].map((item: any) => item[0].type)),
    ["event"],
  );
  assert.ok(!JSON.stringify(result).includes("private@example.invalid"));
});

test("Node HTTP requests, process sessions and env-enabled tracing cannot bypass error scrubbing", () => {
  const result = run(`
    const Sentry = require('@sentry/node');
    ${common}
    (async()=>{
      const client = Sentry.init({...base,...errorOnlyMonitoringOptions(Sentry.httpIntegration({sessions:false}))});
      assert.equal(client.getIntegrationByName('ProcessSession'),undefined);
      assert.equal(client.getOptions().tracesSampleRate,0);
      const http = require('node:http');
      const server = http.createServer((_req,res)=>res.end('ok'));
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      try {
        const response = await fetch('http://127.0.0.1:'+server.address().port);
        await response.text();
        await client.flush();
        assert.equal(envelopes.length,0,'successful requests must not send sessions');
        Sentry.startSpan({name:'private@example.invalid'},()=>{});
        Sentry.captureException(new Error('private@example.invalid'));
        client.recordDroppedEvent('before_send','error');
        await client.flush();
        console.log(JSON.stringify(envelopes));
      } finally {
        await new Promise(resolve=>server.close(resolve));
        await Sentry.close();
      }
    })().catch(error=>{console.error(error);process.exitCode=1;});
  `);
  assert.equal(result.length, 1);
  assert.deepEqual(
    result.flatMap((envelope: any) => envelope[1].map((item: any) => item[0].type)),
    ["event"],
  );
  assert.ok(!JSON.stringify(result).includes("private@example.invalid"));
});
