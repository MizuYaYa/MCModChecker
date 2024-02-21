import { intro, outro, confirm, select, multiselect, spinner, isCancel, cancel, text } from '@clack/prompts';
import pc from "picocolors";
import * as fs from "node:fs/promises";
import {generate, parse, transform, stringify} from 'csv/sync';
import * as path from 'node:path';
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

async function convert_to_json_wizard() {
  //ESMでも__filenameと__dirnameが利用できるように...
  const file_path = fileURLToPath(import.meta.url);
  const dir_path = path.dirname(file_path);

  const json_export_path = path.resolve(dir_path, "../export");

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
      if (!(/.+\.csv$/.test(value)) || value === undefined) return "csvファイルの場所を入力してください";
    }
  });
  
  //^Cされた時の挙動
  if (isCancel(table_path)) {
    cancel("キャンセルされました");
    return process.exit(0);
  }

  //ここから、受け取ったCSVファイルをJsonに変換
  const s = spinner();
  s.start("CSVファイルをJSONに変換中");

  //csvのpathを渡してjsonを貰う
  const mods_json = await csv_to_json(table_path);

  s.stop("変換完了");


  await fs.writeFile(`${json_export_path}/mods.json`, mods_json).catch(async (err) => {
    if (err.code === "ENOENT") {
      await fs.mkdir(json_export_path).catch(console.error);
      await fs.writeFile(`${json_export_path}/mods.json`, mods_json).catch(console.error);
    } else {
      console.error(err);
    }
  });

  outro(`完了しました\n ${json_export_path}\\mods.json`);
}

//csvをjsonに変換する関数
async function csv_to_json(path) {
  const csv_data = await fs.readFile(path).catch(console.error);
  const records = parse(csv_data, {columns: true});
  
  //mods管理データのインスタンスを作成
  const mods = new McmcMods(records[0], records[1], records[2]);

  //csvファイルの4行目からのmodデータを挿入
  for (let i = 3; i < records.length; i++) {
    mods.pushMods(records[i]);
  }

  return JSON.stringify(mods, null, 2);
}

export { convert_to_json_wizard, csv_to_json, McmcMods };