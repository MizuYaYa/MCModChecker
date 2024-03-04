import { checkMods, showChangeMods } from "./client/check.js";

function mcmc_test(mod_set, test_name) {
  console.log(`==========${test_name}==========`);
  console.log("typeof: ", typeof mod_set);
  if (typeof mod_set === "object" && "changeMods" in mod_set) {
    console.log("成功");
    showChangeMods(mod_set);
    return 0;
  } else if (mod_set.code === 0) {
    console.log("チェックの必要がない(バージョンが同じなど)");
    console.log("return: ", mod_set);
    return 0;
  } else if (mod_set.code === 1) {
    console.log("何らかのエラー");
    console.log("return: ", mod_set);
  } else {
    console.log("失敗");
    console.log("return: ", mod_set);
  }
  return 1;
}

async function main() {
  // ケース1 modsに_mcmc.jsonがある場合
  const case_1_mod_set = checkMods(local_mods_path, host_mcmc_path).catch(err => ({
    code: 1,
    error: err,
  }));

  // ケース2 modsに_mcmc.jsonが無い場合
  const case_2_mod_set = checkMods(none_mcmc_mods_path, host_mcmc_path).catch(err => ({
    code: 1,
    error: err,
  }));

  const case_1_return_code = mcmc_test(await case_1_mod_set, "ケース1");
  const case_2_return_code = mcmc_test(await case_2_mod_set, "ケース2");

  console.log(`ケース1: ${case_1_return_code}\nケース2: ${case_2_return_code}`);
}

const local_mods_path = "";
const none_mcmc_mods_path = "";
const host_mcmc_path = "";
// const host_mcmc_path = "";

process.argv.includes("--UseSetInterval") ? setInterval(main(), 60000) : main() ;
