import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        paper: "#fbfaf6",
        chalk: "#f1f7f4",
        fern: "#1f7a65",
        coral: "#d85f45",
        marigold: "#d9941f"
      },
      boxShadow: {
        soft: "0 16px 40px rgba(23, 32, 42, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
