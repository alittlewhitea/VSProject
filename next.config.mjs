/** @type {import('next').NextConfig} */
const deploymentId =
  process.env.NEXT_DEPLOYMENT_ID?.trim() ||
  process.env.DEPLOYMENT_VERSION?.trim() ||
  process.env.GIT_SHA?.trim();

const nextConfig = {
  ...(deploymentId ? { deploymentId } : {})
};

export default nextConfig;
