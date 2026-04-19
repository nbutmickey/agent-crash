// jest.setup.ts — load .env.local for tests (Next.js doesn't auto-load it in Jest)
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
