import { convertToJsonWizard, csvToObj } from "./host/convert.js";
import { Command } from "commander";
import { checkModsWizard, showChangeMods, readMcmcFiles, checkMods } from "./client/check.js";
import * as fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import pc from "picocolors";


const file_path = fileURLToPath(import.meta.url);
const dir_path = path.dirname(file_path);

const package_path = path.resolve(dir_path, "../package.json");
const npmPackage = JSON.parse(await fs.readFile(package_path, "utf-8"));


const program = new Command();
program
  .name(npmPackage.name)
  .version(npmPackage.version)
  .description(npmPackage.description)
  .option("-c, --create", "createモードで実行")
  .option("-p, --path <path...>", "path")
  .option("-w, --writeFile", "ファイルに書き出しをします");

program.parse();
const opts = program.opts();

if (opts.path && opts.create) {
  //createMode時のパスのバリデーションを行う
  const is_csv_mcmc = !/.+\.csv$/.test(opts.path[0]);
  // fs.statでディレクトリの存在確認を行い、pathが指定されていなかったらTrueでデフォのexportを使う
  const is_valid_path = opts.path[1] ? await fs.stat(opts.path[1]) : true;
  if (!is_csv_mcmc || !is_valid_path) throw new TypeError("無効なパスです");
} else if (opts.path) {
  //checkMode時のパスのバリデーションを行う
  const is_local_mcmc = /.+mods$/.test(opts.path[0]);
  const is_host_mcmc = /^(https|http):\/\/.+|.+\.json$/.test(opts.path[1]);
  if (!is_local_mcmc || !is_host_mcmc) throw new TypeError("無効なパスです");
}

// -wオプションは対話型形式では無効
// node .\src\app.js -c  (createモードを対話型形式で開始)
// node .\src\app.js -c -p <CSVPath exportPath=./MCModChecker/export>  (非対話型形式で開始 csvを変換したデータをJSON形式で出力)
// node .\src\app.js -c -p <CSVPath exportPath?> -w  (mcmcのファイルを指定した場所かexportに保存される。)
if (opts.create && opts.path) {
  const csv_data = await fs.readFile(opts.path[0]);
  const mods = await csvToObj(csv_data);
  const json = JSON.stringify(mods, null, 2);
  if (opts.writeFile) {
    const export_path = opts.path[1] ? opts.path[1] : path.resolve(dir_path, "./export");
    const export_mcmc_path = path.resolve(export_path, `${mods.mcmc.name}-${mods.mcmc.version}-mcmc.json`);
    await fs.writeFile(export_mcmc_path, json, {flag: "wx"}).catch(async err => {
      if (err.code === "ENOENT") {
        await fs.mkdir(export_path);
        await fs.writeFile(export_mcmc_path, json, {flag: "wx"});
      } else if (err.code === "EEXIST") {
        console.log("既にファイルが存在しています");
        throw err;
      } else {
        throw err;
      }
    });
    console.log(`完了しました\n ${pc.gray(pathToFileURL(export_mcmc_path))}`);
  } else {
    console.log(json);
  }

  process.exit(0);
} else if (opts.create) {
  await convertToJsonWizard();

  process.exit(0);
}

// node .\src\app.js  (checkモードを対話型形式で開始)デフォ
// node .\src\app.js -p C:\Users\[user]\AppData\Roaming\.minecraft\mods https://exsample.com/NAME-0-mcmc.json (非対話型形式で開始 modSetクラスをJSON形式で出力する)
// node .\src\app.js -p <localModsPath HostMcmc> -w  (mcmcのファイルが保存される)
if (opts.path) {
  const mcmc_files = await readMcmcFiles(opts.path[0], opts.path[1]);
  const mod_set = await checkMods(mcmc_files);

  if (mod_set.code === 0) {
    console.log("バージョンが最新ではないため、変更の必要はありません。");
    console.log(`v${mod_set.old_version} => v${mod_set.new_version}`);
    process.exit(0);
  }

  if (opts.writeFile) {
    showChangeMods(mod_set);

    const local_mcmc_path = path.resolve(opts.path[0], "_mcmc.json");
    const mcmc_json = JSON.stringify(mcmc_files[1], null, 2);
    await fs.writeFile(local_mcmc_path, mcmc_json);
    console.log(local_mcmc_path, "ここで保存する");
  } else {
    console.log(JSON.stringify(mod_set, null, 2));
  }

  process.exit(0);
}

await checkModsWizard();
