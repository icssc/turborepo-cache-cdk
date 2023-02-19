#!/usr/bin/env node
import "dotenv/config";

import { App } from "aws-cdk-lib";

import CacheStack from "./cacheStack";

const app = new App({ autoSynth: true });
new CacheStack(app, "turborepo-cache-stack");
