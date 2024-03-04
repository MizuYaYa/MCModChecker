import { cancel, intro, isCancel, outro, spinner, text } from "@clack/prompts";
import pc from "picocolors";
import * as fs from "node:fs/promises";
import path from "node:path";

class ModSet {
  constructor() {
    this.changeMods = [];
    this.noChangeMods = [];
    this.unexpectedMods = [];
  }
  pushChangeMod(mod_obj) {
    this.changeMods.push(mod_obj);
  }
  pushNoChangeMod(mod_obj) {
    this.noChangeMods.push(mod_obj);
  }
  pushUnexpectedMod(mod_obj) {
    this.unexpectedMods.push(mod_obj);
  }
}

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
    message: `チェックしたいmodsフォルダの場所を入力してください${pc.gray("Ctrl+Cで終了")}`,
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
    message: `ホストから提供されたjsonファイルの場所を入力してください${pc.gray("Ctrl+Cで終了")}`,
    placeholder: "例(C:\\Users\\[ユーザー名]\\Downloads\\mods.json)",
    validate(value) {
      if (!/^(https|http):\/\/.+|.+\.json$/.test(value) || value === undefined) return "jsonファイルの場所を入力してください";
    }
  });

  if (isCancel(new_mcmc_json_path)) {
    cancel("キャンセルされました");
    return 0;
  }

  const s = spinner();
  s.start("変更を確認中");

  const mod_set = await checkMods(check_mods_path, new_mcmc_json_path).catch(err => {
    s.stop("変更を確認できません");
    cancel("エラーが発生しました");
    throw err;
  });

  s.stop("確認された変更");

  if (mod_set.return_value === 0) {
    outro("終了しました。");
    console.log(`バージョンが同じ又は低いため、変更の必要はありません。\n v${mod_set.old_version} => v${mod_set.new_version}`);
    return 0;
  }else if (mod_set.return_value === 1) {
    console.log(`想定外のエラーが発生しました。`);
    return 1;
  }

  outro("完了しました");
  return mod_set;
}

async function checkMods(mods_path, new_mcmc_path) {
  const file_names = await fs.readdir(mods_path).catch(err => {throw err});
  const new_mcmc = await parseMcmc(new_mcmc_path).catch(err => {throw err});
  const mod_set = new ModSet();

  const new_mods = Object.keys(new_mcmc).map((key) => new_mcmc[key]).flat();

  const new_mcmc_version = parseInt(new_mcmc.mcmc.version);
  if (typeof new_mcmc_version === "number" && Number.isNaN(new_mcmc_version)) {
    throw new TypeError(`${new_mcmc_version} is not a integer`);
  }

  if (file_names.includes("_mcmc.json")) {
    const mcmc = await parseMcmc(path.resolve(mods_path, "_mcmc.json")).catch(err => {throw err});
    const mcmc_version = parseInt(mcmc.mcmc.version);
    if (typeof mcmc_version === "number" && Number.isNaN(mcmc_version)) {
      throw new TypeError(`${mcmc_version} is not a integer`);
    }

    if (mcmc_version < new_mcmc_version) {
      //ホストから提供されたmcmc.jsonが新しい時の処理
      //古いmcmcオブジェクトをフラット化
      const mods = Object.keys(mcmc).map((key) => mcmc[key]).flat();
      return compareMods(new_mods, mods, file_names, mod_set);
    } else if (mcmc_version >= new_mcmc_version) {
      //mcmcのバージョンが同じなので変える必要はない
      return {
        return_value: 0,
        old_version: mcmc_version,
        new_version: new_mcmc_version,
      };
    }
  } else {
    //modsフォルダに_mcmc.jsonが無い場合
    return compareMods(new_mods, undefined, file_names, mod_set);
  }

  throw new Error("An unexpected error has occurred.");
}

async function parseMcmc(path) {
  try {
    return JSON.parse(await fs.readFile(path, "utf8"));
  } catch (err) {
    throw err;
  }
}

function compareMods(new_mods, mods, file_names, mod_set) {
  new_mods.forEach(new_mod => {
    const old_mod = mods?.find(mod => mod.name === new_mod.name);
    const is_exists_mod_file = file_names.includes(new_mod.fileName);
    if (old_mod && old_mod.version !== new_mod.version && !is_exists_mod_file) {
      //modが更新でバージョンが異なる時の処理
      mod_set.pushChangeMod({
        name: new_mod.name,
        changeStatus: "update",
        newVersion: new_mod.version,
        oldVersion: old_mod.version,
        newFileName: new_mod.fileName,
        oldFileName: old_mod.fileName,
        description: new_mod.description,
        source: new_mod.source,
      });
    } else if (old_mod && old_mod.version === new_mod.version || is_exists_mod_file) {
      //modのバージョンが同じ時の処理
      mod_set.pushNoChangeMod({
        name: new_mod.name,
        changeStatus: "same",
        version: new_mod.version,
        description: new_mod.description,
        source: new_mod.source,
        fileName: new_mod.fileName,
      });
    } else if (!old_mod && !is_exists_mod_file) {
      //modが追加されている時の処理
      mod_set.pushChangeMod({
        name: new_mod.name,
        changeStatus: "new",
        newVersion: new_mod.version,
        newFileName: new_mod.fileName,
        description: new_mod.description,
        source: new_mod.source,
      });
    } else {
      mod_set.pushUnexpectedMod({
        old_mod: old_mod,
        new_mod: new_mod,
      });
    }
  });
  const new_mod_names = new_mods.map(new_mod => new_mod.name);
  mods?.forEach(mod => {
    const is_exists_mod = new_mod_names.includes(mod.name);
    if (!is_exists_mod) {
      mod_set.pushChangeMod({
        name: mod.name,
        changeStatus: "delete",
        oldVersion: mod.version,
        oldFileName: mod.fileName,
        description: mod.description,
        source: mod.source
      });
    }
  });
  return mod_set;
}

function showChangeMods(mod_set) {
  const changeMods = mod_set.changeMods;
  const unexpectedMods = mod_set.unexpectedMods;
  console.log(`${pc.gray("┌")}  変更があるMOD一覧`);
  console.log(pc.gray("│"));
  for (let i = 0; i < changeMods.length; i++) {
    const mod = changeMods[i];
    if (mod.changeStatus === "new") {
      console.log(
        `${pc.green("◆")}  ${mod.name} ${pc.gray(`(new) => (${mod.newFileName})`)}\n${pc.blue("│    new")} ${pc.red("=>")} ${pc.green(`v${mod.newVersion}`)}\n${pc.blue("│")}    ${mod.description}\n${pc.blue("│")}    ${pc.gray(`${mod.source}`)}`
      );
    } else if (mod.changeStatus === "delete") {
      console.log(
        `${pc.green("◆")}  ${mod.name} ${pc.gray(`(${mod.oldFileName}) => (delete)`)}\n${pc.magenta("│")}    ${pc.red(`v${mod.oldVersion} =>`)} ${pc.magenta("delete")}\n${pc.magenta("│")}    ${mod.description}\n${pc.magenta("│")}    ${pc.gray(`${mod.source}`)}`
      );
    } else if (mod.changeStatus === "update") {
      console.log(
        `${pc.green("◆")}  ${mod.name} ${pc.gray(`(${mod.oldFileName}) => (${mod.newFileName})`)}\n${pc.green("│")}    ${pc.red(`${mod.oldVersion} =>`)} ${pc.green(`v${mod.newVersion}`)}\n${pc.green("│")}    ${mod.description}\n${pc.green("│")}    ${pc.gray(`${mod.source}`)}`
      );
    }
  }
  if (!unexpectedMods.length === 0) {
    console.log(`想定していないデータが入ったオブジェクトが${unexpectedMods.length}個あります。`);
    console.log("=====ここから=====");
    console.log(unexpectedMods);
    console.log("=====ここまで=====");
  }
}

export { checkModsWizard, checkMods, compareMods, showChangeMods, ModSet };
