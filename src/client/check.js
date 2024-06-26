import { cancel, intro, isCancel, outro, select, spinner, text, confirm } from "@clack/prompts";
import pc from "picocolors";
import * as fs from "node:fs/promises";
import path from "node:path";

class ModSet {
  constructor() {
    this.mods = [];
    this.unexpectedMods = [];
  }
  pushMod(new_mod, old_mod, changeStatus, isApplyChange = false) {
    const obj = {
      name: new_mod.name,
      changeStatus: changeStatus,
      isApplyChange: isApplyChange,
      description: new_mod.description,
      source: new_mod.source,
    };
    if (["update", "new", "same"].includes(changeStatus)) {
      obj.newVersion = new_mod.version;
      obj.newFileName = new_mod.fileName;
    }
    if (["update", "delete"].includes(changeStatus)) {
      obj.oldVersion = old_mod.version;
      obj.oldFileName = old_mod.fileName;
    }
    this.mods.push(obj);
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
    message: `チェックしたいmodsフォルダの場所を入力してください ${pc.gray("Ctrl+Cで終了")}`,
    placeholder: "例(C:\\Users\\[ユーザー名]\\AppData\\Roaming\\.minecraft\\mods)",
    validate(value) {
      if (!/.+mods$/.test(value) || value === undefined) return "modsフォルダの場所を入力してください";
    },
  });

  if (isCancel(local_mods_path)) {
    cancel("キャンセルされました");
    return 0;
  }

  //ホスト側から提供される新しいjsonのパスを質問
  const host_mcmc_path = await text({
    message: `ホストから提供されたjsonファイルの場所を入力してください ${pc.gray("Ctrl+Cで終了")}`,
    placeholder: "例(C:\\Users\\[ユーザー名]\\Downloads\\mods.json)",
    validate(value) {
      if (!/^(https|http):\/\/.+|.+\.json$/.test(value) || value === undefined) return "jsonファイルの場所を入力してください";
    },
  });

  if (isCancel(host_mcmc_path)) {
    cancel("キャンセルされました");
    return 0;
  }

  const s = spinner();
  s.start("ファイルを読み取り中");

  const mcmc_files = await readMcmcFiles(local_mods_path, host_mcmc_path).catch(err => {
    s.stop("変更を確認できません");
    cancel("ファイルの読み取りに失敗しました。");
    throw err;
  });

  s.message("変更を確認中");

  const mod_set = await checkMods(mcmc_files).catch(err => {
    s.stop("変更を確認できません");
    cancel("エラーが発生しました");
    throw err;
  });

  s.stop("確認された変更");

  if (mod_set.code === 0) {
    outro("終了しました。");
    console.log(`バージョンが最新ではないため、変更の必要はありません。\n v${mod_set.old_version} => v${mod_set.new_version}`);
    return 0;
  } else if (mod_set.code === 1) {
    console.log(`想定外のエラーが発生しました。`);
    return 1;
  }

  showChangeMods(mod_set);

  while (true) {
    const select_prompt = await select({
      message: "選択してください",
      options: [
        { value: "showMods", label: "modsの変更を再確認して表示" },
        { value: "writeExit", label: "変更を保存して終了" },
      ],
    });

    if (isCancel(select_prompt)) {
      const confirm_exit = await confirm({
        message: "保存しないで終了しますか？",
      });
      if (confirm_exit) {
        cancel("終了しました");
        return 0;
      }
      continue;
    }

    if (select_prompt === "writeExit") {
      // ここでhost_mcmcファイルの書き込みを行う
      const local_mcmc_path = path.resolve(local_mods_path, "_mcmc.json");
      const mcmc_json = JSON.stringify(mcmc_files[1], null, 2);
      await fs.writeFile(local_mcmc_path, mcmc_json);

      break;
    } else if (select_prompt === "showMods") {
      const current_file_names = await fs.readdir(local_mods_path);
      updateApplyChangeFile(mod_set, current_file_names);
      showChangeMods(mod_set);
    }
  }

  outro("完了しました");
  return mod_set;
}

//modSetクラスのchangeModsをforで回して、current_file_namesをFileNameでincludesする
function updateApplyChangeFile(mod_set, current_file_names) {
  for (let i = 0; i < mod_set.mods.length; i++) {
    const mod = mod_set.mods[i];
    //new_file_existsがTrueだったらmodsに新しいmodが入ってる
    const new_file_exists = current_file_names.includes(mod.newFileName);
    //old_file_existsがTrueだったらまだ古いmodが削除されていない
    const old_file_exists = current_file_names.includes(mod.oldFileName);
    const isApplyChangedFile = (() => {
      switch (mod.changeStatus) {
        case "update":
          //modsに新しいmodがあって古いmodが削除されてた場合True
          return new_file_exists && !old_file_exists;
        case "new":
          //modsに新しいmodがある場合True
          return new_file_exists;
        case "delete":
          //modsに古いmodが削除されていたらTrue
          //existsがTrueだったらdeleteする予定のファイルが削除されていないということなのでstatusは未適用のfalse
          return !old_file_exists;
        case "same":
          //modsに不足しているmodがない場合True
          return new_file_exists;

        default:
          console.log(`new_file_exists: ${new_file_exists}, old_file_exists: ${old_file_exists}\n`, mod);
          return false;
      }
    })();
    //isApplyChangedがFalse(if True)だったらファイル変更がmodsに適用されていないことになる
    //isApplyChangedがTrue(if False)だったらファイル変更がmodsに適用されていることになる
    //ここから処理したいのは、ファイルの変更がmodsに適用されていた場合isApplyChangeをTrueにする
    if (isApplyChangedFile) {
      mod.isApplyChange = true;
    }
  }
}

async function readMcmcFiles(local_mods_path, host_mcmc_path) {
  let file_names, host_mcmc, local_mcmc;
  try {
    const parseMcmc = async path => JSON.parse(await fs.readFile(path, "utf8"));
    const isUrl     = /^(https|http):\/\/.+/.test(host_mcmc_path);
    file_names = fs.readdir(local_mods_path, { withFileTypes: true });
    host_mcmc  = isUrl ? (await fetch(host_mcmc_path)).json() : parseMcmc(host_mcmc_path);
    local_mcmc = parseMcmc(path.resolve(local_mods_path, "_mcmc.json")).catch(err => {
      if (err.code === "ENOENT") return undefined;
      throw err;
    });
  } catch (err) {
    throw err;
  }

  return [await local_mcmc, await host_mcmc, await file_names];
}

async function checkMods([local_mcmc, host_mcmc, file_names]) {
  const mod_set = new ModSet();
  const host_mods = Object.keys(host_mcmc).map(key => host_mcmc[key]).flat();
  const host_mcmc_version = validateParseInt(host_mcmc.mcmc.version);

  if (file_names.some(file_name => file_name.name === "_mcmc.json")) {
    const local_mcmc_version = validateParseInt(local_mcmc.mcmc.version);

    if (local_mcmc_version <= host_mcmc_version) {
      //ホストから提供されたmcmc.jsonが新しいまたは同じ時の処理
      //古いmcmcオブジェクトをフラット化
      const local_mods = Object.keys(local_mcmc).map(key => local_mcmc[key]).flat();
      return compareMods(host_mods, local_mods, file_names, mod_set);
    } else if (local_mcmc_version > host_mcmc_version) {
      //mcmcのバージョンが古いので変える必要はない
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
    const mod_file_exists = file_names.some(file_name => file_name.name === new_mod.fileName);

    if (old_mod && old_mod.version !== new_mod.version) {
      //modが更新でバージョンが異なる時の処理
      mod_set.pushMod(new_mod, old_mod, "update", mod_file_exists);

    } else if (old_mod && old_mod.version === new_mod.version) {
      //modのバージョンが同じ時の処理
      mod_set.pushMod(new_mod, undefined, "same", mod_file_exists);

    } else if (!old_mod) {
      //modが追加されている時の処理
      mod_set.pushMod(new_mod, undefined, "new", mod_file_exists);

    } else {
      mod_set.pushUnexpectedMod({
        old_mod: old_mod,
        new_mod: new_mod,
      });
    }
  });
  if (!old_mods) return mod_set;
  const new_mod_names = new_mods.map(new_mod => new_mod.name);
  old_mods?.forEach(mod => {
    const mod_name_exists = new_mod_names.includes(mod.name);
    if (!mod_name_exists) {
      //modがhost_mcmcから削除されている時の処理
      const mod_exists_in_mods = file_names.some(file_name => file_name.name === mod.fileName);
      mod_set.pushMod(mod, mod, "delete", !mod_exists_in_mods);
    }
  });
  file_names.forEach(file_info => {
    const file_name_exists = old_mods.find(mod => mod.fileName === file_info.name);
    const ignore = ["_mcmc.json"];
    if (!file_name_exists && file_info.isFile() && !ignore.includes(file_info.name)) {
      const mod = {
        name: file_info.name,
        description: "",
        version: "",
        fileName: file_info.name,
        source: "",
      };
      mod_set.pushMod(mod, mod, "delete");
    }
  });
  return mod_set;
}

function showChangeMods(mod_set) {
  const mods = mod_set.mods;
  const unexpectedMods = mod_set.unexpectedMods;
  console.log(`${pc.gray("┌")}  変更があるMOD一覧`);
  console.log(pc.gray("│"));
  for (let i = 0; i < mods.length; i++) {
    const mod = mods[i];
    if (mod.isApplyChange) continue;
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
        `${pc.green("◆")}  ${mod.name} ${pc.gray(`(${mod.oldFileName}) => (${mod.newFileName})`)}\n${pc.green("│")}    ${pc.red(`v${mod.oldVersion} =>`)} ${pc.green(`v${mod.newVersion}`)}\n${pc.green("│")}    ${mod.description}\n${pc.green("│")}    ${pc.gray(`${mod.source}`)}`
      );
    } else if (mod.changeStatus === "same") {
      console.log(
        `${pc.green("◆")}  ${mod.name} ${pc.gray(`(add) => (${mod.newFileName})`)}\n${pc.blue("│    add")} ${pc.red("=>")} ${pc.green(`v${mod.newVersion}`)}\n${pc.blue("│")}    ${mod.description}\n${pc.blue("│")}    ${pc.gray(`${mod.source}`)}`
      );
    }
  }
  if (unexpectedMods.length > 0) {
    console.log(`想定していないデータが入ったオブジェクトが${unexpectedMods.length}個あります。`);
    console.log("=====ここから=====");
    console.log(unexpectedMods);
    console.log("=====ここまで=====");
  }
}

export { checkModsWizard, checkMods, compareMods, showChangeMods, ModSet, readMcmcFiles, updateApplyChangeFile };
