import { intro, outro, confirm, select, multiselect, spinner, isCancel, cancel, text } from "@clack/prompts";
import pc from "picocolors";
import * as fs from "node:fs/promises";
import { generate, parse, transform, stringify } from "csv/sync";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "url";

class McmcMods {
  constructor(mcmc, game, modLoader) {
    this.mcmc = mcmc;
    this.game = game;
    this.modLoader = modLoader;
    this.mods = [];
  }
  pushMods(record) {
    this.mods.push(record);
  }
}

async function convertToJsonWizard() {
  //ESMでも__filenameと__dirnameが利用できるように...
  const file_path = fileURLToPath(import.meta.url);
  const dir_path = path.dirname(file_path);

  const export_path = path.resolve(dir_path, "../export");

  //これやるとかっこいい
  console.log(`   __  __  ___ __  __  ___          ___ ___ ___   _ _____ ___
  |  \\/  |/ __|  \\/  |/ __|  ___   / __| _ \\ __| /_\\_   _| __|
  | |\\/| | (__| |\\/| | (__  |___| | (__|   / _| / _ \\| | | _|
  |_|  |_|\\___|_|  |_|\\___|        \\___|_|_\\___/_/ \\_\\_| |___|
                                                            `);
  intro(pc.bgCyan(pc.black("サーバー管理者向けjson作成ツール")));

  //jsonにしたいcsvファイルの場所を質問
  const table_path = await text({
    message: "csvファイルの場所を入力してください",
    placeholder: "例(C:\\Users\\%USERNAME%\\Downloads\\mod.csv)",
    validate(value) {
      if (!/.+\.csv$/.test(value) || value === undefined) return "csvファイルの場所を入力してください";
    },
  });

  //^Cされた時の挙動
  if (isCancel(table_path)) {
    cancel("キャンセルされました");
    return 0;
  }

  //ここから、受け取ったCSVファイルをJsonに変換
  const s = spinner();
  s.start("ファイルを読み取り中");

  const csv_data = await fs.readFile(table_path);

  s.message("CSVファイルをJSONに変換中");

  //csvのpathを渡してjsonを貰う
  const mods = await csvToObj(csv_data);

  s.message("ファイルを書き込み中");

  const export_mcmc_path = path.resolve(export_path, `${mods.mcmc.name}-${mods.mcmc.version}-mcmc.json`);
  const file = await fs.writeFile(export_mcmc_path, JSON.stringify(mods, null, 2), { flag: "wx" }).catch(async err => {
    if (err.code === "ENOENT" || err.code === "EEXIST") {
      return err;
    } else {
      s.stop("ファイル書き込みに失敗");
      cancel("エラーが発生しました");
      throw err;
    }
  });

  if (file?.code === "ENOENT") {
    await fs.mkdir(export_path);
    await fs.writeFile(export_mcmc_path, JSON.stringify(mods, null, 2), { flag: "wx" });
  } else if (file?.code === "EEXIST") {
    s.stop("ファイル書き込み中止");
    const confirm_over_write = await confirm({
      message: `既にファイルがあります。上書きしますか？${pc.gray(`| ${pathToFileURL(export_mcmc_path)}`)}`,
    });
    if (confirm_over_write) {
      s.start("ファイルを上書き中");
      await fs.writeFile(export_mcmc_path, JSON.stringify(mods, null, 2));
    } else {
      outro("終了しました。");
      return 0;
    }
  }

  s.stop("ファイル書き込み完了")

  outro(`完了しました\n   ${pc.gray(pathToFileURL(export_mcmc_path))}`);
}

//csvをjsonに変換する関数
async function csvToObj(data) {
  const records = parse(data, { columns: true });

  //mods管理データのインスタンスを作成
  const mods = new McmcMods(records[0], records[1], records[2]);

  //csvファイルの4行目からのmodデータを挿入
  for (let i = 3; i < records.length; i++) {
    mods.pushMods(records[i]);
  }

  return mods;
}

export { convertToJsonWizard, csvToObj, McmcMods };
