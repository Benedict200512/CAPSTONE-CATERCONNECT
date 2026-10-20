// Focused TypeScript diagnostics for changed payment files. Uses installed
// Supabase/Expo types, with only Deno.env/serve ambient declarations in memory.
// This is not a Deno deployment/bundle check and makes no network calls.
const ts=require('typescript'),path=require('node:path');
const base=path.resolve(__dirname,'..'),canonical=name=>path.resolve(name).toLowerCase();
const files=['supabase/functions/xendit-webhook/index.ts','supabase/functions/xendit-webhook/verify-booking-invoice.ts',
 'supabase/functions/xendit-webhook/verify-subscription-payment.ts','supabase/functions/xendit-payment/index.ts',
 'supabase/functions/xendit-payment/create-checkout.ts','supabase/functions/xendit-check-status/index.ts',
 'lib/xendit.ts','screens/auth/SubscriptionScreen.tsx','screens/auth/PaymentScreen.tsx','app/(tabs)/bookings.tsx'].map(x=>path.join(base,x));
const config=ts.readConfigFile(path.join(base,'tsconfig.json'),ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,base);
const options={...parsed.options,noEmit:true,target:ts.ScriptTarget.ES2020,allowImportingTsExtensions:true};
const ambient=path.join(base,'__payment_check_ambient.d.ts');
const declaration="declare const Deno:{env:{get(name:string):string|undefined}}; declare module 'https://deno.land/std@0.168.0/http/server.ts' { export function serve(fn:(req:Request)=>Promise<Response>|Response):void; }";
const host=ts.createCompilerHost(options),getSource=host.getSourceFile.bind(host),exists=host.fileExists.bind(host),read=host.readFile.bind(host);
host.fileExists=name=>canonical(name)===canonical(ambient)||exists(name);
host.readFile=name=>canonical(name)===canonical(ambient)?declaration:read(name);
host.getSourceFile=(name,version,...rest)=>canonical(name)===canonical(ambient)?ts.createSourceFile(name,declaration,version,true):getSource(name,version,...rest);
host.resolveModuleNames=(names,containing)=>names.map(name=>ts.resolveModuleName(name==='https://esm.sh/@supabase/supabase-js@2'?'@supabase/supabase-js':name,containing,options,host).resolvedModule);
const program=ts.createProgram([...files,ambient],options,host),focus=new Set([...files,ambient].map(canonical));
const errors=ts.getPreEmitDiagnostics(program).filter(d=>!d.file||focus.has(canonical(d.file.fileName)));
if(errors.length){console.log(ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>base,getCanonicalFileName:x=>x,getNewLine:()=> '\n'}));process.exitCode=1;}
else console.log('Focused TypeScript passed for 10 payment/webhook/mobile files.');
