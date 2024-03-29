import { intro, outro, confirm, select, multiselect, spinner, isCancel, cancel, text } from "@clack/prompts";
import pc from "picocolors";
import * as fs from "node:fs/promises";
import { generate, parse, transform, stringify } from "csv/sync";
import * as path from "node:path";
import { fileURLToPath } from "url";

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
  s.start("CSVファイルをJSONに変換中");

  const csv_data = await fs.readFile(table_path);

  //csvのpathを渡してjsonを貰う
  const mods = await csvToJson(csv_data);

  s.stop("変換完了");

  await fs.writeFile(`${export_path}/mods.json`, JSON.stringify(mods, null, 2)).catch(async err => {
    if (err.code === "ENOENT") {
      await fs.mkdir(export_path);
      await fs.writeFile(`${export_path}/mods.json`, JSON.stringify(mods, null, 2));
    } else {
      throw err;
    }
  });

  outro(`完了しました\n ${export_path}\\mods.json`);
}

//csvをjsonに変換する関数
async function csvToJson(data) {
  const records = parse(data, { columns: true });

  //mods管理データのインスタンスを作成
  const mods = new McmcMods(records[0], records[1], records[2]);

  //csvファイルの4行目からのmodデータを挿入
  for (let i = 3; i < records.length; i++) {
    mods.pushMods(records[i]);
  }

  return mods;
}

export { convertToJsonWizard, csvToJson, McmcMods };
