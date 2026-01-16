import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    MY_AWS_KEY: process.env.MY_AWS_KEY,
    MY_AWS_SECRET: process.env.MY_AWS_SECRET,
    OPLAB_API_KEY: process.env.OPLAB_API_KEY,
  },
};

export default nextConfig;
