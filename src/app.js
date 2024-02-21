import { convert_to_json_wizard } from "./host/convert.js";

//ホスト側で作成するcsv表データをjson形式にする
convert_to_json_wizard().catch(console.error);
