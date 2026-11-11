import { build } from "vite";

process.env.BLOCKS_BASE = "/Blocks/";
await build();
