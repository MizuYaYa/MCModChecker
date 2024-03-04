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
  const local_mods_path = await text({
    message: `チェックしたいmodsフォルダの場所を入力してください${pc.gray("Ctrl+Cで終了")}`,
    placeholder: "例(C:\\Users\\[ユーザー名]\\AppData\\Roaming\\.minecraft\\mods)",
    validate(value) {
      if (!/.+mods$/.test(value) || value === undefined) return "modsフォルダの場所を入力してください";
    }
  });

  if (isCancel(local_mods_path)) {
    cancel("キャンセルされました");
    return 0;
  }

  //ホスト側から提供される新しいjsonのパスを質問
  const host_mcmc_path = await text({
    message: `ホストから提供されたjsonファイルの場所を入力してください${pc.gray("Ctrl+Cで終了")}`,
    placeholder: "例(C:\\Users\\[ユーザー名]\\Downloads\\mods.json)",
    validate(value) {
      if (!/^(https|http):\/\/.+|.+\.json$/.test(value) || value === undefined) return "jsonファイルの場所を入力してください";
    }
  });

  if (isCancel(host_mcmc_path)) {
    cancel("キャンセルされました");
    return 0;
  }

  const s = spinner();
  s.start("変更を確認中");

  const mod_set = await checkMods(local_mods_path, host_mcmc_path).catch(err => {
    s.stop("変更を確認できません");
    cancel("エラーが発生しました");
    throw err;
  });

  s.stop("確認された変更");

  if (mod_set.code === 0) {
    outro("終了しました。");
    console.log(`バージョンが同じ又は低いため、変更の必要はありません。\n v${mod_set.old_version} => v${mod_set.new_version}`);
    return 0;
  }else if (mod_set.code === 1) {
    console.log(`想定外のエラーが発生しました。`);
    return 1;
  }

  outro("完了しました");
  return mod_set;
}

async function checkMods(local_mods_path, host_mcmc_path) {
  const [host_mcmc, file_names, local_mcmc] = await (async () => {
    let file_names, host_mcmc, local_mcmc;
    try {
      const parseMcmc = async path => JSON.parse(await fs.readFile(path, "utf8"));
      file_names = fs.readdir(local_mods_path);
      host_mcmc = parseMcmc(host_mcmc_path);
      local_mcmc = parseMcmc(path.resolve(local_mods_path, "_mcmc.json")).catch(err => {
        if (err.code === "ENOENT") return undefined;
        throw err;
      });
    } catch (err) {
      throw err;
    }
    return [await host_mcmc, await file_names, await local_mcmc];
  })();

  const mod_set = new ModSet();
  const host_mods = Object.keys(host_mcmc).map((key) => host_mcmc[key]).flat();
  const host_mcmc_version = validateParseInt(host_mcmc.mcmc.version);

  if (file_names.includes("_mcmc.json")) {
    const local_mcmc_version = validateParseInt(local_mcmc.mcmc.version);

    if (local_mcmc_version < host_mcmc_version) {
      //ホストから提供されたmcmc.jsonが新しい時の処理
      //古いmcmcオブジェクトをフラット化
      const local_mods = Object.keys(local_mcmc).map((key) => local_mcmc[key]).flat();
      return compareMods(host_mods, local_mods, file_names, mod_set);
    } else if (local_mcmc_version >= host_mcmc_version) {
      //mcmcのバージョンが同じなので変える必要はない
      return {
        code: 0,
        old_version: local_mcmc_version,
        new_version: host_mcmc_version,
      };
    }
  } else {
    //modsフォルダに_mcmc.jsonが無い場合
    return compareMods(host_mods, undefined, file_names, mod_set);
  }

  throw new Error("An unexpected error has occurred.");
}

function validateParseInt(str) {
  const int = parseInt(str);
  if (Number.isInteger(int)) return int;
  throw new TypeError(`${int} is not a integer`);
}

function compareMods(new_mods, old_mods, file_names, mod_set) {
  new_mods.forEach(new_mod => {
    const old_mod = old_mods?.find(mod => mod.name === new_mod.name);
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
  old_mods?.forEach(mod => {
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
