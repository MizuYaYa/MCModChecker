import { cancel, intro, isCancel, outro, text } from "@clack/prompts";
import pc from "picocolors";

async function checkModsWizard() {
  //これやるとかっこいい
  console.log(`   __  __  ___ __  __  ___          ___ _  _ ___ ___ _  __
  |  \\/  |/ __|  \\/  |/ __|  ___   / __| || | __/ __| |/ /
  | |\\/| | (__| |\\/| | (__  |___| | (__| __ | _| (__| ' < 
  |_|  |_|\\___|_|  |_|\\___|        \\___|_||_|___\\___|_|\\_\\
                                                          `);

  intro(pc.bgGreen(pc.black(" modチェッカー ")));

  //チェックしたいmodsフォルダのパスを質問
  const check_mods_path = await text({
    message: "チェックしたいmodsフォルダの場所を入力してください",
    placeholder: "例(C:\\Users\\[ユーザー名]\\AppData\\Roaming\\.minecraft\\mods)",
    validate(value) {
      if (!/.+mods$/.test(value) || value === undefined) return "modsフォルダの場所を入力してください";
    }
  });

  if (isCancel(check_mods_path)) {
    cancel("キャンセルされました");
    return 0;
  }

  //ホスト側から提供される新しいjsonのパスを質問
  const new_mcmc_json_path = await text({
    message: "ホストから提供されたjsonファイルの場所を入力してください",
    placeholder: "例(C:\\Users\\[ユーザー名]\\Downloads\\mods.json)",
    validate(value) {
      if (value === undefined) return "jsonファイルの場所を入力してください";
    }
  });

  if (isCancel(new_mcmc_json_path)) {
    cancel("キャンセルされました");
    return 0;
  }


  outro("完了しました");
}


checkModsWizard().catch(console.error);
