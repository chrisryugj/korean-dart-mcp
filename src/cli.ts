#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { VERSION } from "./version.js";

const program = new Command();

program
  .name("korean-dart")
  .description("OpenDART CLI — 공시/재무/지분 조회")
  .version(VERSION);

program
  .command("resolve <keyword>")
  .description("회사명 → corp_code 조회")
  .action(async (_keyword: string) => {
    console.log("TODO: corp_code resolver 구현 예정");
  });

program
  .command("search <keyword>")
  .description("공시 검색")
  .action(async (_keyword: string) => {
    console.log("TODO: search_disclosures 구현 예정");
  });

program.parseAsync(process.argv);
