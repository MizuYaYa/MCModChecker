import { intro, outro, confirm, select, multiselect, spinner, isCancel, cancel, text } from '@clack/prompts';
import pc from "picocolors";

async function convert_to_json_wizard() {
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

  s.stop("完了");

  //変換が完了した後に出力するjsonファイルの場所を指定
  const json_output_path = await text({
    message: "JSONファイルの出力先を入力してください",
    placeholder: "例(C:\\Users\\%USERNAME%\\Downloads)",
    validate(value) {
      if (value === undefined) return "何かがおかしいです。";
    }
  });

  //^Cされた時の挙動
  if (isCancel(json_output_path)) {
    cancel("キャンセルされました");
    return process.exit(0);
  }

  outro("完了しました");
  console.log(`table_path: ${table_path}`);
}

//csvをjsonに変換する関数
function csv_to_json(path) {
  
  return json;
}


convert_to_json_wizard().catch(console.error);