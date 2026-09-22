import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    // Next defaults to 4 page-generation workers regardless of available RAM — on
    // Render's small free-tier instance that's enough concurrent Node processes
    // (each loading the generated Prisma client) to blow the heap and SIGABRT
    // (exit 134) mid-deploy. This app has no real static-gen workload to parallelize
    // anyway (every route is server-rendered on demand), so force a single worker.
    cpus: 1,
  },
};

export default nextConfig;
