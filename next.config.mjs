/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDFs are sent to the extract route as multipart form data.
  // Vercel caps serverless request bodies at ~4.5 MB, so the app enforces a 4 MB limit.
};
export default nextConfig;
