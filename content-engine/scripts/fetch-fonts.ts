import { ensureFonts } from "../src/server/render/fonts";

ensureFonts({ force: true })
  .then((f) => console.log("폰트 준비 완료:", f))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
