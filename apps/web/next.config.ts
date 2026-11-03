import type {NextConfig} from 'next';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const local=process.env.NODE_ENV==='development'&&process.env.ZELUMI_LOCAL_DEV==='1';
const config:NextConfig={
 output:local?undefined:'export',trailingSlash:true,poweredByHeader:false,
 turbopack:{root:resolve(dirname(fileURLToPath(import.meta.url)),'../..')},
 ...(local?{
  distDir:'.next-local',skipTrailingSlashRedirect:true,
  async rewrites(){return [{source:'/api/:path*',destination:'http://127.0.0.1:8788/api/:path*'},{source:'/auth/:path*',destination:'http://127.0.0.1:8788/auth/:path*'}];}
 }:{}),
};
export default config;
